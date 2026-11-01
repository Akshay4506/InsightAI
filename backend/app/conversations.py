"""Chat history persisted in MongoDB: conversations (tied to a dataset) and their messages."""
from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import datasets, mongo
from app.auth import current_user
from app.dataset_ctx import MULTI_PREFIX, SAMPLE_ID, DatasetContext
from app.models import AskResponse

router = APIRouter(prefix="/api", tags=["history"])
STORED_ROWS = 200  # cap rows persisted per answer (charts/tables stay usable, docs stay small)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _owned(user: dict, conv_id: str) -> dict:
    try:
        conv = mongo.db().conversations.find_one({"_id": ObjectId(conv_id), "user_id": user["_id"]})
    except Exception:
        conv = None
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


def record_exchange(user: dict, conv_id: str | None, ctx: DatasetContext, question: str,
                    res: AskResponse) -> str:
    """Persist the question + answer; creates the conversation on first message. Returns its id."""
    db = mongo.db()
    if conv_id:
        conv = _owned(user, conv_id)
        cid = conv["_id"]
        upd = {"updated_at": _now(), "dataset_id": ctx.id, "dataset_name": ctx.name}
        if conv.get("untitled"):  # chat was created by an upload: the first question names it
            upd.update(title=question[:80], untitled=False)
        db.conversations.update_one({"_id": cid}, {"$set": upd})
    else:
        cid = db.conversations.insert_one({
            "user_id": user["_id"], "title": question[:80], "dataset_id": ctx.id,
            "dataset_name": ctx.name, "created_at": _now(), "updated_at": _now()}).inserted_id
    stored = res.model_dump()
    stored["data"] = stored["data"][:STORED_ROWS]
    db.messages.insert_many([
        {"conversation_id": cid, "role": "user", "text": question, "created_at": _now()},
        {"conversation_id": cid, "role": "assistant", "result": stored, "created_at": _now()},
    ])
    return str(cid)


def _available(dataset_id: str, live_ids: set[str]) -> bool:
    if dataset_id.startswith(MULTI_PREFIX):
        return all(i in live_ids for i in dataset_id[len(MULTI_PREFIX):].split(","))
    return dataset_id == SAMPLE_ID or dataset_id in live_ids


def _summary(c: dict, live_ids: set[str]) -> dict:
    return {"id": str(c["_id"]), "title": c["title"], "dataset_id": c["dataset_id"],
            "dataset_name": c["dataset_name"],
            "dataset_available": _available(c["dataset_id"], live_ids),
            "updated_at": c["updated_at"].isoformat()}


@router.get("/history")
def history(user: dict = Depends(current_user)) -> list[dict]:
    db = mongo.db()
    convs = list(db.conversations.find({"user_id": user["_id"]}).sort("updated_at", -1).limit(50))
    live = {str(d["_id"]) for d in db.datasets.find({"user_id": user["_id"]}, {"_id": 1})}
    return [_summary(c, live) for c in convs]


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, user: dict = Depends(current_user)) -> dict:
    conv = _owned(user, conv_id)
    live = {str(d["_id"]) for d in mongo.db().datasets.find({"user_id": user["_id"]}, {"_id": 1})}
    msgs = mongo.db().messages.find({"conversation_id": conv["_id"]}).sort("created_at", 1)
    return {"conversation": _summary(conv, live),
            "messages": [{"id": str(m["_id"]), "role": m["role"], "text": m.get("text"), "result": m.get("result")}
                         for m in msgs]}


class RenameBody(BaseModel):
    title: str


class TruncateBody(BaseModel):
    keep_exchanges: int


@router.patch("/conversations/{conv_id}")
def rename_conversation(conv_id: str, body: RenameBody, user: dict = Depends(current_user)) -> dict:
    conv = _owned(user, conv_id)
    title = " ".join(body.title.split())
    if not title:
        raise HTTPException(400, "Name cannot be empty")
    if len(title) > 80:
        raise HTTPException(400, "Name is too long (max 80 characters)")
    mongo.db().conversations.update_one({"_id": conv["_id"]}, {"$set": {"title": title, "untitled": False}})
    return {"id": conv_id, "title": title}


@router.post("/conversations/{conv_id}/truncate")
def truncate_conversation(conv_id: str, body: TruncateBody, user: dict = Depends(current_user)) -> dict:
    """Editing a prompt rewinds the chat: keep the first N question/answer pairs and drop the rest."""
    conv = _owned(user, conv_id)
    keep = max(0, body.keep_exchanges)
    msgs = list(mongo.db().messages.find({"conversation_id": conv["_id"]}, {"_id": 1}).sort([("created_at", 1), ("_id", 1)]))
    drop = [m["_id"] for m in msgs[keep * 2:]]
    if drop:
        mongo.db().messages.delete_many({"_id": {"$in": drop}})
    mongo.db().conversations.update_one({"_id": conv["_id"]}, {"$set": {"updated_at": _now()}})
    return {"status": "ok", "deleted": len(drop)}


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, user: dict = Depends(current_user)) -> dict:
    conv = _owned(user, conv_id)
    for d in list(mongo.db().datasets.find({"conversation_id": conv["_id"]})):  # files live and die with their chat
        datasets.remove_dataset(d)
    mongo.db().messages.delete_many({"conversation_id": conv["_id"]})
    mongo.db().conversations.delete_one({"_id": conv["_id"]})
    return {"status": "ok"}


@router.post("/reset-history")
def reset_history(user: dict = Depends(current_user)) -> dict:
    db = mongo.db()
    for d in list(db.datasets.find({"user_id": user["_id"]})):
        datasets.remove_dataset(d)
    ids = [c["_id"] for c in db.conversations.find({"user_id": user["_id"]}, {"_id": 1})]
    db.messages.delete_many({"conversation_id": {"$in": ids}})
    db.conversations.delete_many({"user_id": user["_id"]})
    return {"status": "ok"}
