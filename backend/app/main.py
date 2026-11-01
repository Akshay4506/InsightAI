"""FastAPI entrypoint: auth, datasets, ask, history, schema, health."""
from __future__ import annotations

import threading
from contextlib import asynccontextmanager

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from app import auth, config, conversations, datasets, llm, mongo, pipeline
from app.dataset_ctx import SAMPLE_ID
from app.db import seed
from app.models import AskRequest, AskResponse, CancelRequest
from app.rag import indexer


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Seed the sample DB, build its schema index and connect to MongoDB on start."""
    if not config.DB_PATH.exists():
        seed.build()
    await run_in_threadpool(mongo.db)
    await run_in_threadpool(datasets.migrate_legacy)
    await run_in_threadpool(indexer.build_index)
    yield


app = FastAPI(title="InsightAI", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_origin_regex=config.CORS_ORIGIN_REGEX, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(conversations.router)


@app.get("/api/health")
def health() -> dict:
    try:
        mongo.client().admin.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok", "llm": llm.provider_status(), "mongo": db_ok}


# Cancel flags per (user, request id). The cancel call may arrive before the ask registers, so both sides use setdefault.
_CANCELS: dict[str, threading.Event] = {}


def _flag(user: dict, request_id: str) -> threading.Event:
    if len(_CANCELS) > 2000:  # stale tombstones from cancels that never matched a request
        _CANCELS.clear()
    return _CANCELS.setdefault(f"{user['_id']}:{request_id}", threading.Event())


def _ask(req: AskRequest, user: dict) -> AskResponse:
    conv_id = req.conversation_id
    if req.dataset_id != SAMPLE_ID:
        ids = datasets.split_ids(req.dataset_id)
        oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        docs = list(mongo.db().datasets.find({"_id": {"$in": oids}, "user_id": user["_id"]}))
        if len(oids) != len(ids) or len(docs) != len(ids):
            raise HTTPException(404, "Dataset not found")
        owners = {str(d.get("conversation_id")) for d in docs}
        if conv_id and owners != {conv_id}:
            raise HTTPException(400, "These files belong to a different chat")
        if not conv_id and len(owners) == 1:
            conv_id = owners.pop()
    ctx = datasets.get_context(user, req.dataset_id)
    question = req.question.strip()
    cancel = _flag(user, req.request_id) if req.request_id else None
    try:
        res = pipeline.run(question, ctx, cancel)
        if cancel is not None and cancel.is_set():  # stopped by the user: do not save the exchange
            return res
    finally:
        if req.request_id:
            _CANCELS.pop(f"{user['_id']}:{req.request_id}", None)
    res.conversation_id = conversations.record_exchange(user, conv_id, ctx, question, res)
    res.dataset_id, res.dataset_name = ctx.id, ctx.name
    return res


@app.post("/api/ask", response_model=AskResponse)
def ask(req: AskRequest, user: dict = Depends(auth.current_user)) -> AskResponse:
    """Run the agentic pipeline on the chosen dataset (sync route -> FastAPI worker thread)."""
    return _ask(req, user)


@app.post("/api/ask/cancel")
def cancel_ask(body: CancelRequest, user: dict = Depends(auth.current_user)) -> dict:
    """Stop button: the pipeline checks this flag between steps and the answer is never saved."""
    _flag(user, body.request_id).set()
    return {"status": "ok"}


@app.get("/api/schema")
def schema(dataset_id: str = "sample", user: dict = Depends(auth.current_user)) -> dict:
    """Tables and columns of a dataset for the sidebar Schema Explorer."""
    ctx = datasets.get_context(user, dataset_id)
    return {"tables": indexer.introspect(ctx.db_path, ctx.tables)}
