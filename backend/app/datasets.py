"""User datasets: upload CSV/XLSX -> clean -> SQLite (per dataset) + GridFS original + Mongo metadata.

Flow: the original file is stored in MongoDB GridFS and a metadata document in
`datasets`. For querying, the file is materialised into a read-only SQLite file
(cache dir, rebuilt from GridFS if missing) so the same validated Text-to-SQL
pipeline works on any upload.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import shutil
import sqlite3
from datetime import datetime, timezone

import pandas as pd
from bson import ObjectId
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app import config, mongo
from app.auth import current_user
from app.dataset_ctx import MULTI_PREFIX, SAMPLE, SAMPLE_ID, DatasetContext
from app.rag import indexer

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

_RESERVED = {"order", "group", "table", "index", "select", "from", "where", "values", "key", "check",
             "limit", "join", "on", "as", "by", "and", "or", "not", "null", "default", "case", "when"}
_DATE_NAME = re.compile(r"date|time|month|day|created|updated|_at$|^dt$|timestamp", re.I)


# ----------------------------------------------------------------- parsing
def _snake(name: object, fallback: str) -> str:
    s = re.sub(r"[^0-9a-zA-Z]+", "_", str(name).strip()).strip("_").lower() or fallback
    if s[0].isdigit():
        s = f"c_{s}"
    return f"{s}_col" if s in _RESERVED else s


def _unique(names: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    out = []
    for n in names:
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    return out


def _read_csv(raw: bytes) -> pd.DataFrame:
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    try:
        sep = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|").delimiter
    except csv.Error:
        sep = ","
    return pd.read_csv(io.StringIO(text), sep=sep)


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise names, drop empty rows/cols, coerce numbers and dates."""
    df = df.dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)
    df.columns = _unique([_snake(c, f"column_{i + 1}") for i, c in enumerate(df.columns)])
    for col in df.columns:
        s = df[col]
        if pd.api.types.is_bool_dtype(s):
            df[col] = s.astype(int)
        elif pd.api.types.is_datetime64_any_dtype(s):
            df[col] = _fmt_dates(s)
        elif s.dtype == object or pd.api.types.is_string_dtype(s):
            txt = s.dropna().astype(str).str.strip()
            if txt.empty:
                continue
            num = pd.to_numeric(txt.str.replace(r"[,$€£₹%\s]", "", regex=True), errors="coerce")
            if num.notna().mean() >= 0.95:
                df[col] = pd.to_numeric(s.astype(str).str.replace(r"[,$€£₹%\s]", "", regex=True), errors="coerce")
                continue
            if _DATE_NAME.search(col) or txt.str.match(r"^\d{4}-\d{2}-\d{2}|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}").mean() > 0.9:
                parsed = pd.to_datetime(s, errors="coerce")
                if parsed.notna().sum() >= 0.9 * s.notna().sum():
                    df[col] = _fmt_dates(parsed)
                    continue
            df[col] = s.where(s.isna(), s.astype(str).str.strip())
    return df


def _fmt_dates(s: pd.Series) -> pd.Series:
    has_time = (s.dropna().dt.normalize() != s.dropna()).any()
    return s.dt.strftime("%Y-%m-%d %H:%M:%S" if has_time else "%Y-%m-%d").where(s.notna(), None)


def parse_file(filename: str, raw: bytes) -> dict[str, pd.DataFrame]:
    """Return {table_name: cleaned DataFrame}; raises ValueError with a friendly message."""
    lower = filename.lower()
    stem = filename.rsplit(".", 1)[0]
    try:
        if lower.endswith((".csv", ".tsv", ".txt")):
            frames = {_snake(stem, "data"): _read_csv(raw)}
        elif lower.endswith((".xlsx", ".xlsm")):
            sheets = pd.read_excel(io.BytesIO(raw), sheet_name=None, engine="openpyxl")
            names = _unique([_snake(n, "sheet") for n in sheets])
            frames = dict(zip(names, sheets.values()))
        elif lower.endswith(".xls"):
            raise ValueError("Old .xls files are not supported - save as .xlsx or .csv")
        else:
            raise ValueError("Unsupported file type - upload a .csv or .xlsx file")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Could not read the file: {str(exc)[:120]}") from exc

    out = {}
    for name, df in frames.items():
        df = _clean(df)
        if len(df.columns) and len(df):
            out[name] = df
    if not out:
        raise ValueError("The file has no data rows")
    if len(out) > 10:
        raise ValueError("Too many sheets (max 10)")
    if sum(len(d) for d in out.values()) > config.MAX_UPLOAD_ROWS:
        raise ValueError(f"Too many rows (max {config.MAX_UPLOAD_ROWS:,})")
    return out


def write_sqlite(frames: dict[str, pd.DataFrame], path) -> list[dict]:
    """Write frames to a SQLite file and return table metadata."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    meta = []
    try:
        for table, df in frames.items():
            dtypes = {c: "DATE" for c in df.columns if _DATE_NAME.search(c) and (df[c].dtype == object or pd.api.types.is_string_dtype(df[c]))
                      and df[c].dropna().astype(str).str.match(r"^\d{4}-\d{2}-\d{2}").all()}
            df.to_sql(table, con, index=False, dtype=dtypes or None)
            cols = [{"name": r[1], "type": r[2] or "TEXT"} for r in con.execute(f'PRAGMA table_info("{table}")')]
            meta.append({"table": table, "rows": int(len(df)), "columns": cols})
        con.commit()
    finally:
        con.close()
    return meta


def make_suggestions(meta: list[dict]) -> list[str]:
    """A few starter questions derived from the column types."""
    t = meta[0]
    cols = t["columns"]
    num = [c["name"] for c in cols if c["type"].upper() in {"INTEGER", "REAL", "FLOAT"} and not c["name"].endswith("id")]
    cat = [c["name"] for c in cols if c["type"].upper() == "TEXT"]
    date = [c["name"] for c in cols if "DATE" in c["type"].upper()]
    h = lambda x: x.replace("_", " ")  # noqa: E731
    out = [f"How many rows are in {h(t['table'])}?", f"Show the first 10 rows of {h(t['table'])}"]
    if num and cat:
        out.insert(0, f"What is the total {h(num[0])} by {h(cat[0])}?")
        out.append(f"Top 5 {h(cat[0])} by {h(num[0])}")
    if num and date:
        out.append(f"How does {h(num[0])} change by month?")
    return out[:4]


# ----------------------------------------------------------------- contexts
def _cache_path(ds_id: str):
    return config.DATA_CACHE_DIR / f"{ds_id}.db"


def get_context(user: dict, dataset_id: str) -> DatasetContext:
    """Resolve a dataset id (or the sample) to a DatasetContext the user may query."""
    if dataset_id == SAMPLE_ID:
        return SAMPLE
    if dataset_id.startswith(MULTI_PREFIX):
        return _multi_context(user, [i for i in dataset_id[len(MULTI_PREFIX):].split(",") if i])
    try:
        doc = mongo.db().datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["_id"]})
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(404, "Dataset not found")
    path = _cache_path(dataset_id)
    if not path.exists():  # fresh machine / cache wiped: rebuild from the stored original
        raw = mongo.files().get(doc["file_id"]).read()
        write_sqlite(parse_file(doc["name"], raw), path)
    return DatasetContext(
        id=dataset_id, name=doc["name"], db_path=path,
        tables=frozenset(t["table"] for t in doc["tables"]), collection=f"ds_{dataset_id}",
        row_count=doc["row_count"], suggestions=tuple(doc.get("suggestions", [])))


def _multi_context(user: dict, ids: list[str]) -> DatasetContext:
    """Combine several of the user's uploads into one queryable SQLite file so questions can join across files.

    Tables keep their names (prefixed with the file name only on a clash), and the
    schema index records which file each table came from plus likely join keys.
    """
    ids = sorted(dict.fromkeys(ids))
    if not 2 <= len(ids) <= 6:
        raise HTTPException(400, "Pick between 2 and 6 datasets")
    parts = [get_context(user, i) for i in ids]  # ownership check + cache rebuild per file
    if any(p.is_sample or p.is_multi for p in parts):
        raise HTTPException(400, "Only uploaded files can be combined")

    used: set[str] = set()
    plan: list[tuple[int, str, str]] = []  # (part index, source table, combined table)
    for i, p in enumerate(parts):
        stem = _snake(p.name.rsplit(".", 1)[0], "data")
        for t in sorted(p.tables):
            out, n = t, 2
            if out in used:
                out = f"{stem}_{t}"
            while out in used:
                out, n = f"{stem}_{t}_{n}", n + 1
            used.add(out)
            plan.append((i, t, out))

    key = hashlib.sha1(",".join(ids).encode()).hexdigest()[:12]
    path = _cache_path(f"multi_{key}")
    if not path.exists():
        tmp = path.with_suffix(".tmp")
        tmp.unlink(missing_ok=True)
        con = sqlite3.connect(tmp)
        try:
            for i, p in enumerate(parts):
                con.execute(f"ATTACH DATABASE ? AS s{i}", (str(p.db_path),))
            for i, t, out in plan:
                row = con.execute(f"SELECT sql FROM s{i}.sqlite_master WHERE type='table' AND name=?", (t,)).fetchone()
                ddl = (row[0] if row else "").replace(f'"{t}"', f'"{out}"', 1)  # keep column types (DATE etc.)
                if ddl.upper().startswith("CREATE TABLE"):
                    con.execute(ddl)
                    con.execute(f'INSERT INTO "{out}" SELECT * FROM s{i}."{t}"')
                else:
                    con.execute(f'CREATE TABLE "{out}" AS SELECT * FROM s{i}."{t}"')
            con.commit()
        except Exception:
            con.close()
            tmp.unlink(missing_ok=True)
            raise
        con.close()
        tmp.replace(path)

    return DatasetContext(
        id=MULTI_PREFIX + ",".join(ids), name=" + ".join(p.name for p in parts), db_path=path,
        tables=frozenset(o for _, _, o in plan), collection=f"ds_multi_{key}",
        row_count=sum(p.row_count or 0 for p in parts),
        sources=tuple((out, parts[i].name) for i, _, out in plan))


def summary(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "kind": doc["kind"], "size": doc["size"],
            "rows": doc["row_count"], "tables": doc["tables"], "suggestions": doc.get("suggestions", []),
            "conversation_id": str(doc["conversation_id"]) if doc.get("conversation_id") else None,
            "created_at": doc["created_at"].isoformat()}


def sample_summary() -> dict:
    return {"id": SAMPLE_ID, "name": SAMPLE.name, "kind": "sample", "size": 0, "rows": None,
            "tables": [{"table": t["table"], "rows": None, "columns": t["columns"]} for t in indexer.introspect()],
            "suggestions": list(SAMPLE.suggestions), "created_at": None}


# ----------------------------------------------------------------- routes
@router.get("")
def list_datasets(conversation_id: str | None = None, user: dict = Depends(current_user)) -> list[dict]:
    """Files uploaded in one chat. Datasets are scoped to the chat they were uploaded in."""
    if not conversation_id or not ObjectId.is_valid(conversation_id):
        return []
    docs = mongo.db().datasets.find({"user_id": user["_id"], "conversation_id": ObjectId(conversation_id)}).sort("created_at", 1)
    return [summary(d) for d in docs]


@router.post("")
def upload(file: UploadFile = File(...), conversation_id: str | None = Form(None),
           user: dict = Depends(current_user)) -> dict:
    """Upload a file into a chat (a new chat is created when none is given)."""
    db = mongo.db()
    conv = None
    if conversation_id:
        conv = db.conversations.find_one({"_id": ObjectId(conversation_id), "user_id": user["_id"]}) \
            if ObjectId.is_valid(conversation_id) else None
        if not conv:
            raise HTTPException(404, "Chat not found")

    raw = file.file.read(config.MAX_UPLOAD_MB * 1024 * 1024 + 1)
    if len(raw) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File too large (max {config.MAX_UPLOAD_MB} MB)")
    filename = file.filename or "dataset.csv"
    try:
        frames = parse_file(filename, raw)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    now = datetime.now(timezone.utc)
    if conv is None:
        conv_oid = db.conversations.insert_one({
            "user_id": user["_id"], "title": "New chat", "untitled": True, "dataset_id": "",
            "dataset_name": filename, "created_at": now, "updated_at": now}).inserted_id
    else:
        conv_oid = conv["_id"]

    ds_id = ObjectId()
    meta = write_sqlite(frames, _cache_path(str(ds_id)))
    file_id = mongo.files().put(raw, filename=filename, user_id=user["_id"])
    doc = {"_id": ds_id, "user_id": user["_id"], "conversation_id": conv_oid, "name": filename,
           "kind": "xlsx" if filename.lower().endswith(("xlsx", "xlsm")) else "csv",
           "size": len(raw), "tables": meta, "row_count": sum(t["rows"] for t in meta),
           "suggestions": make_suggestions(meta), "file_id": file_id, "created_at": now}
    db.datasets.insert_one(doc)
    db.conversations.update_one({"_id": conv_oid}, {"$set": {"dataset_id": str(ds_id), "dataset_name": filename, "updated_at": now}})
    indexer.build_index(get_context(user, str(ds_id)))  # embed schema now so the first question is fast
    return {**summary(doc), "conversation_id": str(conv_oid)}


class RenameBody(BaseModel):
    name: str


@router.patch("/{dataset_id}")
def rename_dataset(dataset_id: str, body: RenameBody, user: dict = Depends(current_user)) -> dict:
    """Rename an uploaded file. The original extension is kept (it decides how the file is re-parsed)."""
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(400, "Invalid dataset")
    db = mongo.db()
    doc = db.datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["_id"]})
    if not doc:
        raise HTTPException(404, "Dataset not found")
    new = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "", body.name).strip().lstrip(".").strip()
    ext = "." + doc["name"].rsplit(".", 1)[1] if "." in doc["name"] else ""
    if ext and new.lower().endswith(ext.lower()):
        new = new[: -len(ext)].rstrip()
    if not new:
        raise HTTPException(400, "Name cannot be empty")
    if len(new) > 80:
        raise HTTPException(400, "Name is too long (max 80 characters)")
    new += ext
    clash = db.datasets.find_one({"conversation_id": doc.get("conversation_id"), "_id": {"$ne": doc["_id"]},
                                  "name": {"$regex": f"^{re.escape(new)}$", "$options": "i"}})
    if clash:
        raise HTTPException(409, "Another file in this chat already has that name")
    db.datasets.update_one({"_id": doc["_id"]}, {"$set": {"name": new}})
    db.conversations.update_many({"user_id": user["_id"], "dataset_id": dataset_id}, {"$set": {"dataset_name": new}})
    indexer.drop_index(f"ds_{dataset_id}")  # schema text mentions the file name: re-embed on next question
    doc["name"] = new
    return summary(doc)


@router.get("/{dataset_id}/preview")
def preview(dataset_id: str, table: str | None = None, limit: int = 500, user: dict = Depends(current_user)) -> dict:
    """First rows of one table of an uploaded file, for the in-app data viewer."""
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(400, "Invalid dataset")
    ctx = get_context(user, dataset_id)
    names = sorted(ctx.tables)
    name = table if table in ctx.tables else (names[0] if names else None)
    if name is None:
        raise HTTPException(404, "No tables in this dataset")
    limit = max(1, min(limit, 1000))
    con = sqlite3.connect(f"file:{ctx.db_path.as_posix()}?mode=ro", uri=True)
    try:
        con.execute("PRAGMA query_only=ON")
        total = con.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        cur = con.execute(f'SELECT * FROM "{name}" LIMIT ?', (limit,))
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        con.close()
    return {"id": dataset_id, "name": ctx.name, "tables": names, "table": name, "columns": cols,
            "rows": rows, "total_rows": total, "limit": limit}


def remove_dataset(doc: dict) -> None:
    """Delete one dataset everywhere: metadata, GridFS original, vector index and SQLite cache."""
    mongo.db().datasets.delete_one({"_id": doc["_id"]})
    try:
        mongo.files().delete(doc["file_id"])
    except Exception:
        pass
    indexer.drop_index(f"ds_{doc['_id']}")
    _cache_path(str(doc["_id"])).unlink(missing_ok=True)


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, user: dict = Depends(current_user)) -> dict:
    if not ObjectId.is_valid(dataset_id):
        raise HTTPException(400, "Delete the individual files instead")
    doc = mongo.db().datasets.find_one({"_id": ObjectId(dataset_id), "user_id": user["_id"]})
    if not doc:
        raise HTTPException(404, "Dataset not found")
    remove_dataset(doc)
    return {"status": "ok"}


def split_ids(dataset_id: str) -> list[str]:
    """'multi:a,b' -> [a, b]; a plain id -> [id]."""
    if dataset_id.startswith(MULTI_PREFIX):
        return [i for i in dataset_id[len(MULTI_PREFIX):].split(",") if i]
    return [dataset_id]


def migrate_legacy() -> None:
    """Datasets from before chat-scoping: attach each to the chat that used it (or give it its own chat)."""
    db = mongo.db()
    now = datetime.now(timezone.utc)
    for d in list(db.datasets.find({"conversation_id": {"$exists": False}})):
        sid = str(d["_id"])
        conv = db.conversations.find_one({"user_id": d["user_id"], "dataset_id": {"$regex": sid}})
        cid = conv["_id"] if conv else db.conversations.insert_one({
            "user_id": d["user_id"], "title": d["name"], "untitled": True, "dataset_id": sid,
            "dataset_name": d["name"], "created_at": now, "updated_at": now}).inserted_id
        db.datasets.update_one({"_id": d["_id"]}, {"$set": {"conversation_id": cid}})


def purge_cache() -> None:
    """Dev helper: remove all cached SQLite copies."""
    shutil.rmtree(config.DATA_CACHE_DIR, ignore_errors=True)
