"""Retrieve the top-K most relevant table chunks for a question."""
from __future__ import annotations

import chromadb

from app import config, llm
from app.dataset_ctx import SAMPLE, DatasetContext
from app.rag.indexer import build_index

# Sample data only: tables most questions need joined together; pulled in when a
# neighbour is retrieved so the LLM always sees the join path.
_JOIN_NEIGHBOURS = {"order_items": ["orders", "products"], "products": ["categories"]}


def _query(col, question: str, embedder: str, k: int):
    """Query the collection with a vector from the same embedder used to index it."""
    vec = llm.gemini_embed([question])[0] if embedder == "gemini" else llm.local_embed([question])[0]
    return col.query(query_embeddings=[vec], n_results=min(k, col.count()))


def retrieve(question: str, ctx: DatasetContext = SAMPLE, k: int = 3) -> dict:
    """Return {"chunks": [text], "tables": [names], "embedder": str}."""
    embedder = build_index(ctx)
    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    col = client.get_collection(ctx.collection)

    if not ctx.is_sample and col.count() <= (12 if ctx.is_multi else k):
        # Small upload: no need to rank, hand the LLM every table (saves an embedding call).
        got = col.get()
        return {"chunks": list(got["documents"]), "tables": list(got["ids"]), "embedder": embedder}

    try:
        res = _query(col, question, embedder, k)
    except Exception:
        # Gemini embedding unavailable at query time: rebuild the index locally and retry.
        embedder = build_index(ctx, force=True, force_local=True)
        col = chromadb.PersistentClient(path=str(config.CHROMA_DIR)).get_collection(ctx.collection)
        res = _query(col, question, embedder, k)
    tables = [m["table"] for m in res["metadatas"][0]]
    chunks = list(res["documents"][0])

    if ctx.is_sample:
        extra = [n for t in list(tables) for n in _JOIN_NEIGHBOURS.get(t, []) if n not in tables]
        if extra:
            got = col.get(ids=list(dict.fromkeys(extra)))
            for tid, doc in zip(got["ids"], got["documents"]):
                tables.append(tid)
                chunks.append(doc)
    return {"chunks": chunks, "tables": tables, "embedder": embedder}


if __name__ == "__main__":
    r = retrieve("What were our top 5 products last month?")
    print(r["embedder"], r["tables"])
