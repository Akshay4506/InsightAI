"""Build the ChromaDB collection for a dataset: one chunk per table.

Sample data: columns/types/FKs (SQLAlchemy introspection) + hand-written business
context. Uploaded data: columns/types plus auto-profiled example values and ranges.
Embedded with Gemini; falls back to a local hashed embedding when the API is
unavailable. The embedder used is recorded in the collection metadata so the
retriever queries with the same one.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import chromadb
from sqlalchemy import create_engine, inspect

from app import config, llm
from app.dataset_ctx import SAMPLE, DatasetContext
from app.db.schema_meta import COLUMN_DESCRIPTIONS, TABLE_DESCRIPTIONS


def introspect(db_path: Path = config.DB_PATH, allowed: frozenset[str] | set[str] = config.ALLOWED_TABLES) -> list[dict]:
    """Return [{table, columns:[{name,type,pk,fk}]}] for allowlisted tables."""
    engine = create_engine(f"sqlite:///{db_path}")
    insp = inspect(engine)
    tables = []
    for t in sorted(insp.get_table_names()):
        if t not in allowed:
            continue
        fks = {fk["constrained_columns"][0]: f"{fk['referred_table']}.{fk['referred_columns'][0]}"
               for fk in insp.get_foreign_keys(t)}
        cols = [{"name": c["name"], "type": str(c["type"]), "pk": bool(c.get("primary_key")),
                 "fk": fks.get(c["name"])} for c in insp.get_columns(t)]
        tables.append({"table": t, "columns": cols})
    engine.dispose()
    return tables


def _profile(con: sqlite3.Connection, table: str, col: dict) -> str:
    """Short 'e.g. ...' / 'range ...' note for one uploaded column."""
    q = f'"{col["name"]}"'
    try:
        if col["type"].upper() in {"INTEGER", "REAL", "FLOAT", "NUMERIC", "BIGINT"} or "DATE" in col["type"].upper():
            lo, hi = con.execute(f'SELECT MIN({q}), MAX({q}) FROM "{table}"').fetchone()
            return f"range {lo} to {hi}"
        vals = [str(r[0])[:30] for r in con.execute(
            f'SELECT {q}, COUNT(*) c FROM "{table}" WHERE {q} IS NOT NULL GROUP BY {q} ORDER BY c DESC LIMIT 4')]
        return "e.g. " + ", ".join(vals) if vals else ""
    except sqlite3.Error:
        return ""


def build_chunk(info: dict, ctx: DatasetContext = SAMPLE) -> str:
    """Render one table as an embeddable text chunk."""
    t = info["table"]
    if ctx.is_sample:
        col_txt = ", ".join(
            f"{c['name']} ({c['type']}{' PK' if c['pk'] else ''}{' FK→' + c['fk'] if c['fk'] else ''})"
            for c in info["columns"])
        notes = [f"{k.split('.')[1]}: {v}" for k, v in COLUMN_DESCRIPTIONS.items() if k.startswith(t + ".")]
        chunk = f"Table: {t}\nColumns: {col_txt}\nBusiness context: {TABLE_DESCRIPTIONS.get(t, '')}"
        return chunk + ("\nColumn notes: " + " ".join(notes) if notes else "")

    con = sqlite3.connect(f"file:{ctx.db_path.as_posix()}?mode=ro", uri=True)
    try:
        n = con.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        lines = [f"- {c['name']} ({c['type']}) {_profile(con, t, c)}".rstrip() for c in info["columns"]]
    finally:
        con.close()
    src = dict(ctx.sources).get(t, ctx.name)
    return f"Table: {t} ({n} rows, from uploaded file '{src}')\nColumns:\n" + "\n".join(lines)


def find_links(infos: list[dict]) -> list[tuple[str, str, str, str]]:
    """Likely join keys between tables of different files: same column name, or X_id -> table X(s) with an id."""
    cols = {i["table"]: {c["name"] for c in i["columns"]} for i in infos}
    links: list[tuple[str, str, str, str]] = []
    for a in cols:
        for b in cols:
            if a < b:
                links += [(a, c, b, c) for c in sorted(cols[a] & cols[b]) if c != "id"]
    for a, ac in cols.items():
        for c in sorted(ac):
            if c.endswith("_id") and len(c) > 3:
                base = c[:-3]
                for b, bc in cols.items():
                    if b != a and b in {base, base + "s", base + "es"} and "id" in bc:
                        links.append((a, c, b, "id"))
    return links


def embed_documents(texts: list[str], force_local: bool = False) -> tuple[list[list[float]], str]:
    """Embed with Gemini, else local fallback. Returns (vectors, embedder_name)."""
    if force_local:
        return llm.local_embed(texts), "local"
    try:
        return llm.gemini_embed(texts), "gemini"
    except Exception:
        return llm.local_embed(texts), "local"


def build_index(ctx: DatasetContext = SAMPLE, force: bool = False, force_local: bool = False) -> str:
    """(Re)build the persistent collection if missing; returns embedder name."""
    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    existing = {c if isinstance(c, str) else c.name for c in client.list_collections()}
    if ctx.collection in existing and not force:
        col = client.get_collection(ctx.collection)
        if col.count() == len(ctx.tables):
            return (col.metadata or {}).get("embedder", "local")
        client.delete_collection(ctx.collection)
    elif ctx.collection in existing:
        client.delete_collection(ctx.collection)

    infos = introspect(ctx.db_path, ctx.tables)
    docs = [build_chunk(i, ctx) for i in infos]
    if ctx.is_multi:  # tell the model how the separate files probably connect
        links = find_links(infos)
        docs = [d + "".join(f"\nPossible join: {a}.{ac} = {b}.{bc}" for a, ac, b, bc in links if i["table"] in (a, b))
                for d, i in zip(docs, infos)]
    vectors, embedder = embed_documents(docs, force_local)
    col = client.create_collection(ctx.collection, metadata={"embedder": embedder, "hnsw:space": "cosine"})
    col.add(ids=[i["table"] for i in infos], documents=docs, embeddings=vectors,
            metadatas=[{"table": i["table"]} for i in infos])
    return embedder


def drop_index(ctx_collection: str) -> None:
    """Delete a dataset's collection (when the dataset is removed)."""
    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    try:
        client.delete_collection(ctx_collection)
    except Exception:
        pass


if __name__ == "__main__":
    print("indexed with embedder:", build_index(force=True))
