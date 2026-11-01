"""Authentication: signup, login, current user, change password (bcrypt + JWT)."""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app import config, mongo

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)

# An unset secret still works (dev), but tokens die on restart.
_SECRET = config.JWT_SECRET or secrets.token_hex(32)
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupBody(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    confirm_password: str


class LoginBody(BaseModel):
    identifier: str  # email or phone
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


def normalize_phone(raw: str) -> str:
    """Keep digits and a leading +."""
    raw = raw.strip()
    digits = re.sub(r"\D", "", raw)
    return ("+" if raw.startswith("+") else "") + digits


def _hash(pw: str) -> bytes:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt())


def _check(pw: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(pw.encode()[:72], hashed)


def public_user(u: dict) -> dict:
    return {"id": str(u["_id"]), "name": u["name"], "email": u["email"], "phone": u["phone"],
            "created_at": u["created_at"].isoformat()}


def _token(user_id: ObjectId) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=config.JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, _SECRET, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """FastAPI dependency: the authenticated user document or 401."""
    if creds is None:
        raise HTTPException(401, "Not authenticated")
    try:
        uid = jwt.decode(creds.credentials, _SECRET, algorithms=["HS256"])["sub"]
        user = mongo.db().users.find_one({"_id": ObjectId(uid)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Session expired, please log in again")
    return user


@router.post("/signup")
def signup(body: SignupBody) -> dict:
    name, email, phone = body.name.strip(), body.email.strip().lower(), normalize_phone(body.phone)
    if len(name) < 2:
        raise HTTPException(400, "Please enter your full name")
    if not _EMAIL.match(email):
        raise HTTPException(400, "Enter a valid email address")
    if not 7 <= len(phone.lstrip("+")) <= 15:
        raise HTTPException(400, "Enter a valid phone number")
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if body.password != body.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    doc = {"name": name, "email": email, "phone": phone, "password_hash": _hash(body.password),
           "created_at": datetime.now(timezone.utc)}
    try:
        doc["_id"] = mongo.db().users.insert_one(doc).inserted_id
    except DuplicateKeyError as exc:
        field = "email" if "email" in str(exc) else "phone number"
        raise HTTPException(409, f"An account with this {field} already exists") from exc
    return {"token": _token(doc["_id"]), "user": public_user(doc)}


@router.post("/login")
def login(body: LoginBody) -> dict:
    ident = body.identifier.strip()
    query = {"email": ident.lower()} if "@" in ident else {"phone": normalize_phone(ident)}
    user = mongo.db().users.find_one(query)
    if not user or not _check(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email/phone or password")
    return {"token": _token(user["_id"]), "user": public_user(user)}


@router.get("/me")
def me(user: dict = Depends(current_user)) -> dict:
    return {"user": public_user(user)}


@router.post("/change-password")
def change_password(body: ChangePasswordBody, user: dict = Depends(current_user)) -> dict:
    if not _check(body.old_password, user["password_hash"]):
        raise HTTPException(400, "Old password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters")
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "New passwords do not match")
    if body.new_password == body.old_password:
        raise HTTPException(400, "New password must differ from the old one")
    mongo.db().users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": _hash(body.new_password)}})
    return {"status": "ok"}
