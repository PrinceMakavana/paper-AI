import os
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
from pymongo import MongoClient

from enums import IndexStatus

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "page-index-chatbot")

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None
sync_client: Optional[MongoClient] = None

TOKEN_EXHAUSTED_MESSAGE = "Token balance exhausted."


class TokenBalanceError(RuntimeError):
    pass


async def connect_to_mongo() -> AsyncIOMotorDatabase:
    global client, db

    if db is not None:
        return db

    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    await db.command("ping")
    await ensure_indexes(db)
    return db


async def ensure_indexes(database: AsyncIOMotorDatabase) -> None:
    await database["users"].create_index("email", unique=True)
    await database["pageindex_documents"].create_index("document_id", unique=True)
    await database["pageindex_documents"].create_index("user_id")
    await database["pageindex_documents"].create_index([("user_id", 1), ("createdAt", -1)])


async def close_mongo_connection() -> None:
    global client, db, sync_client

    if client is not None:
        client.close()
    if sync_client is not None:
        sync_client.close()

    client = None
    db = None
    sync_client = None


def get_database() -> AsyncIOMotorDatabase:
    if db is None:
        raise RuntimeError("MongoDB is not connected")

    return db


def pageindex_documents_collection():
    return get_database()["pageindex_documents"]


def users_collection():
    return get_database()["users"]


def _sync_database():
    global sync_client

    if sync_client is None:
        sync_client = MongoClient(MONGODB_URI)

    return sync_client[MONGODB_DB_NAME]


def _user_id_filter(user_id: str):
    if ObjectId.is_valid(user_id):
        return {"_id": ObjectId(user_id)}
    return {"_id": user_id}

async def update_document_index_status(
    doc_id: str,
    index_status: IndexStatus,
    error_message: str | None = None,
) -> None:
    try:
        update = {
            "$set": {
                "index_status": index_status.value,
            }
        }
        if error_message:
            update["$set"]["error_message"] = error_message

        await pageindex_documents_collection().update_one(
            {"document_id": doc_id},
            update,
        )
    except Exception as exc:
        print(f"Failed to update document index status: {exc}")


async def update_document_storage_metadata(doc_id: str, metadata: dict) -> None:
    try:
        await pageindex_documents_collection().update_one(
            {"document_id": doc_id},
            {"$set": metadata},
        )
    except Exception as exc:
        print(f"Failed to update document storage metadata: {exc}")


def increment_document_token_count(doc_id: str, token_delta: int) -> None:
    if not doc_id or not token_delta:
        return

    try:
        sync_db = _sync_database()
        sync_db["pageindex_documents"].update_one(
            {"document_id": doc_id},
            {"$inc": {"token_count": token_delta}},
        )
    except Exception as exc:
        print(f"Failed to increment document token count for {doc_id}: {exc}")


def assert_user_has_tokens(user_id: str | None) -> None:
    if not user_id:
        return

    sync_db = _sync_database()
    user = sync_db["users"].find_one(
        _user_id_filter(user_id),
        {"available_token_count": 1},
    )

    if not user or int(user.get("available_token_count") or 0) <= 0:
        raise TokenBalanceError(TOKEN_EXHAUSTED_MESSAGE)


def consume_user_tokens(user_id: str | None, token_delta: int) -> None:
    if not user_id or not token_delta:
        return

    try:
        sync_db = _sync_database()
        sync_db["users"].update_one(
            _user_id_filter(user_id),
            [
                {
                    "$set": {
                        "available_token_count": {
                            "$max": [
                                0,
                                {"$subtract": [{"$ifNull": ["$available_token_count", 0]}, int(token_delta)]},
                            ]
                        }
                    }
                }
            ],
        )
    except Exception as exc:
        print(f"Failed to consume user tokens for {user_id}: {exc}")


def record_llm_token_usage(doc_id: str | None, user_id: str | None, token_delta: int) -> None:
    if not token_delta:
        return

    if doc_id:
        increment_document_token_count(doc_id, token_delta)
    if user_id:
        consume_user_tokens(user_id, token_delta)
