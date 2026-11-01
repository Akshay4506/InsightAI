"""MongoDB access for the `insight-ai` database (users, datasets, conversations, messages, GridFS)."""
from __future__ import annotations

from functools import lru_cache

import gridfs
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app import config


@lru_cache(maxsize=1)
def client() -> MongoClient:
    return MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=5000)


@lru_cache(maxsize=1)
def db() -> Database:
    """Return the database handle and make sure indexes exist."""
    database = client()[config.MONGODB_DB]
    database.users.create_index([("email", ASCENDING)], unique=True)
    database.users.create_index([("phone", ASCENDING)], unique=True)
    database.datasets.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    database.conversations.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
    database.messages.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)])
    return database


@lru_cache(maxsize=1)
def files() -> gridfs.GridFS:
    """GridFS bucket holding the original uploaded CSV/XLSX files."""
    return gridfs.GridFS(db(), collection="dataset_files")
