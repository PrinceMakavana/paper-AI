import asyncio
import io
import json
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from PyPDF2 import PdfReader

from database import (
    TokenBalanceError,
    close_mongo_connection,
    connect_to_mongo,
    pageindex_documents_collection,
    update_document_index_status,
    update_document_storage_metadata,
)
from enums import IndexStatus
from pageindex.page_index import page_index
from pageindex.utils import ChatLogger, ConfigLoader, get_page_tokens, llm_completion, remove_fields
from storage.s3 import (
    PDF_CONTENT_TYPE,
    S3StorageError,
    build_object_name,
    check_connection as check_s3_connection,
    delete_object,
    download_bytes,
    download_json,
    object_exists,
    object_key_from_s3_uri,
    upload_bytes,
    upload_json,
)

app = FastAPI()
TEMP_UPLOAD_ROOT = os.path.join(tempfile.gettempdir(), "pageindex")

# Only run this many page_index jobs at once (reduces CPU/GPU/RAM spikes from parallel LLM work)
_MAX_CONCURRENT = max(1, int(os.getenv("PAGEINDEX_MAX_CONCURRENT", "1")))
_index_semaphore = asyncio.Semaphore(_MAX_CONCURRENT)

# Queued / running / failed (complete results are read from disk in GET /status)
jobs: dict[str, dict] = {}

os.makedirs(TEMP_UPLOAD_ROOT, exist_ok=True)


@app.on_event("startup")
async def startup_event() -> None:
    try:
        await connect_to_mongo()
        print("Connected to MongoDB")
    except Exception as exc:
        print(f"MongoDB connection failed: {exc}")

    try:
        s3_health = await asyncio.to_thread(check_s3_connection)
        print(f"Connected to S3 bucket: {s3_health['bucket']}")
    except Exception as exc:
        print(f"S3 connection failed: {exc}")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_mongo_connection()


def _temp_doc_dir(doc_id: str) -> str:
    return os.path.join(TEMP_UPLOAD_ROOT, doc_id)


def _temp_pdf_path(doc_id: str) -> str:
    return os.path.join(_temp_doc_dir(doc_id), "source.pdf")


def _pdf_object_name(doc_id: str, user_id: str | None) -> str:
    return build_object_name(user_id, doc_id, "source.pdf")


def _index_object_name(doc_id: str, user_id: str | None) -> str:
    return build_object_name(user_id, doc_id, "page_index.json")


def _resolve_index_object_key(doc_id: str, doc: dict | None, job: dict | None) -> str:
    for source in (doc, job):
        if not source:
            continue
        key = object_key_from_s3_uri(source.get("pageindex_s3_uri"))
        if key:
            return key

    user_id = doc.get("user_id") if doc else job.get("user_id") if job else None
    return _index_object_name(doc_id, user_id)


MODEL_ENV_BY_PROVIDER = {
    "gemini": ("GEMINI_MODEL_NAME", "gemini-3.1-flash-lite-preview"),
    "ollama": ("OLLAMA_MODEL_NAME", "llama3"),
    "openai": ("OPENAI_MODEL_NAME", "gpt-4o-mini"),
    "claude": ("ANTHROPIC_MODEL_NAME", "claude-3-5-sonnet-latest"),
}


def _clean_model_value(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().strip('"').strip("'")


def _default_model_for_provider(provider: str) -> str | None:
    env_primary, env_fallback, fallback = MODEL_ENV_BY_PROVIDER.get(provider, (None, None, None))
    return _clean_model_value(os.getenv(env_primary) or os.getenv(env_fallback) or fallback)


def resolve_pageindex_model(model_provider: str | None, model: str | None) -> tuple[str | None, str | None, str | None]:
    """Return (provider, model_name, provider/model id) for LiteLLM-backed PageIndex calls."""
    provider = _clean_model_value(model_provider)
    model_name = _clean_model_value(model)

    if not provider and model_name and "/" in model_name:
        provider, model_name = model_name.split("/", 1)

    if provider:
        provider = provider.lower()
        if provider == "anthropic":
            provider = "claude"
        if provider == "ollama" and os.getenv("OLLAMA_API_URL") and not os.getenv("OLLAMA_API_BASE"):
            os.environ["OLLAMA_API_BASE"] = os.getenv("OLLAMA_API_URL", "")

    if provider and not model_name:
        model_name = _default_model_for_provider(provider)

    if not provider and model_name:
        return None, model_name, model_name
    if not provider or not model_name:
        return provider, model_name, None

    litellm_provider = "anthropic" if provider == "claude" else provider
    pageindex_model = model_name if "/" in model_name else f"{litellm_provider}/{model_name}"
    return provider, model_name, pageindex_model


def calculate_pdf_input_token_count(file_path: str, model: str | None = None) -> int:
    try:
        page_list = get_page_tokens(file_path, model=model)
        return sum(page[1] for page in page_list)
    except Exception as exc:
        print(f"Failed to calculate upload token count: {exc}")
        return 0


def _map_pdf_storage_metadata(storage_metadata: dict[str, str]) -> dict[str, str]:
    return {
        "pdf_storage_path": storage_metadata["storage_path"],
        "pdf_s3_uri": storage_metadata["s3_uri"],
        "storage_status": "pdf_uploaded",
    }


def _map_index_storage_metadata(storage_metadata: dict[str, str]) -> dict[str, str]:
    return {
        "pageindex_s3_uri": storage_metadata["s3_uri"],
        "storage_status": "uploaded",
        "storage_error_message": None,
    }


def _map_storage_error(message: str) -> dict[str, str]:
    return {
        "storage_status": "failed",
        "storage_error_message": message,
    }


async def run_page_index_job(doc_id: str, file_path: str, model: str | None = None, user_id: str | None = None) -> None:
    async with _index_semaphore:
        current_job = jobs.get(doc_id, {})
        jobs[doc_id] = {
            **current_job,
            "status": IndexStatus.RUNNING.value,
            "user_id": user_id,
        }
        model_label = model 
        print(f"=> Running page index job for document ID: {doc_id} using model: {model_label}")
        await update_document_index_status(doc_id, IndexStatus.RUNNING)
        try:
            result = await asyncio.to_thread(page_index, file_path, model=model, doc_id=doc_id, user_id=user_id)
            index_object_name = _index_object_name(doc_id, user_id)
            index_storage = await asyncio.to_thread(upload_json, result, index_object_name)
            await update_document_storage_metadata(doc_id, _map_index_storage_metadata(index_storage))
            print(f"=> Page index job completed for document ID: {doc_id}")
            await update_document_index_status(doc_id, IndexStatus.COMPLETE)
            jobs[doc_id] = {
                **jobs.get(doc_id, {}),
                "status": IndexStatus.COMPLETE.value,
                "user_id": user_id,
                "pageindex_s3_uri": index_storage["s3_uri"],
            }
        except S3StorageError as e:
            print(f"=> Page index storage failed for document ID: {doc_id} with error: {e}")
            message = f"Page index storage failed: {e}"
            jobs[doc_id] = {"status": IndexStatus.FAILED.value, "error": message}
            await update_document_storage_metadata(doc_id, _map_storage_error(message))
            await update_document_index_status(doc_id, IndexStatus.FAILED, message)
            # Cleanup: Attempt to delete the PDF if it was uploaded to S3
            try:
                pdf_object_name = _pdf_object_name(doc_id, user_id)
                await asyncio.to_thread(delete_object, pdf_object_name)
                print(f"=> Cleaned up PDF from S3: {pdf_object_name}")
            except Exception as cleanup_error:
                print(f"=> Warning: Failed to cleanup PDF from S3: {cleanup_error}")
        except ValueError as e:
            print(f"=> Page index job failed for document ID: {doc_id} with error: {e}")
            jobs[doc_id] = {"status": IndexStatus.FAILED.value, "error": str(e)}
            await update_document_index_status(doc_id, IndexStatus.FAILED, str(e))
        except TokenBalanceError as e:
            print(f"=> Page index job stopped for document ID: {doc_id} with token error: {e}")
            jobs[doc_id] = {"status": IndexStatus.FAILED.value, "error": str(e)}
            await update_document_index_status(doc_id, IndexStatus.FAILED, str(e))
        except Exception as e:
            print(f"=> Page index job failed for document ID: {doc_id} with error: {e}")
            message = f"Page index failed: {e}"
            jobs[doc_id] = {"status": IndexStatus.FAILED.value, "error": message}
            await update_document_index_status(doc_id, IndexStatus.FAILED, message)
        # finally:
        #     shutil.rmtree(_temp_doc_dir(doc_id), ignore_errors=True)



@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health/db")
async def database_health():
    health: dict = {
        "connected": True,
        "mongo": {"connected": False},
        "s3": {"connected": False},
    }
    errors: list[str] = []

    try:
        db = await connect_to_mongo()
        await db.command("ping")
        health["mongo"] = {
            "connected": True,
            "database": os.getenv("MONGODB_DB_NAME", "page-index-chatbot"),
        }
    except Exception as exc:
        health["mongo"]["error"] = str(exc)
        errors.append(f"MongoDB unavailable: {exc}")

    try:
        health["s3"] = await asyncio.to_thread(check_s3_connection)
    except Exception as exc:
        health["s3"]["error"] = str(exc)
        errors.append(f"S3 unavailable: {exc}")

    if errors:
        health["connected"] = False
        health["errors"] = errors
        raise HTTPException(status_code=503, detail=health)

    return health


@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_provider: str | None = Form(None),
    model: str | None = Form(None),
    user_id: str | None = Form(None),
):
    doc_id = str(uuid.uuid4())
    name = file.filename or "upload"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    provider, model_name, pageindex_model = resolve_pageindex_model(
        model_provider,
        model,
    )

    content = await file.read()
    response: dict = {
        "doc_id": doc_id,
        "filename": file.filename,
        "size": len(content),
        "mime_type": file.content_type,
        "indexed": False,
        "job_status": IndexStatus.UNKNOWN.value,
        "index_status": IndexStatus.UNKNOWN.value,
        "status_url": None,
        "token_count": 0,
        "model_provider": provider,
        "model": model_name,
    }

    if ext != "pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    pdf_object_name = _pdf_object_name(doc_id, user_id)
    try:
        pdf_storage = await asyncio.to_thread(upload_bytes, content, pdf_object_name, PDF_CONTENT_TYPE)
    except S3StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload PDF to S3: {exc}") from exc

    response.update({
        "pdf_storage_path": pdf_storage["storage_path"],
        "pdf_s3_uri": pdf_storage["s3_uri"],
        "storage_status": "pdf_uploaded",
    })

    response["token_count"] = 0
    file_path = _temp_pdf_path(doc_id)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content)

    jobs[doc_id] = {
        "status": IndexStatus.QUEUED.value,
        "user_id": user_id,
        "pdf_storage_path": pdf_storage["storage_path"],
        "pdf_s3_uri": pdf_storage["s3_uri"],
    }
    background_tasks.add_task(run_page_index_job, doc_id, file_path, pageindex_model, user_id)
    response["job_status"] = IndexStatus.QUEUED.value
    response["index_status"] = IndexStatus.QUEUED.value
    response["status_url"] = f"/upload/{doc_id}/status"
    return response


@app.get("/upload/{doc_id}/status")
async def get_upload_index_status(doc_id: str):
    """Poll this after POST /upload until job_status is complete or failed."""
    doc = None
    try:
        doc = await pageindex_documents_collection().find_one({"document_id": doc_id})
    except Exception:
        doc = None

    job = jobs.get(doc_id)
    index_object_name = _resolve_index_object_key(doc_id, doc, job)

    try:
        if await asyncio.to_thread(object_exists, index_object_name):
            page_index_payload = await asyncio.to_thread(download_json, index_object_name)
        else:
            page_index_payload = None
    except S3StorageError as exc:
        # Return detailed S3 error information
        raise HTTPException(
            status_code=500, 
            detail=f"S3 storage error retrieving PageIndex: {str(exc)}"
        ) from exc
    except Exception as exc:
        # Handle other exceptions gracefully
        print(f"Error retrieving PageIndex from S3 for {doc_id}: {exc}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to read PageIndex from storage: {str(exc)}"
        ) from exc

    if page_index_payload is not None:
        bucket_name = os.getenv("AWS_S3_BUCKET_NAME")
        pageindex_s3_uri = (
            doc.get("pageindex_s3_uri")
            if doc and doc.get("pageindex_s3_uri")
            else job.get("pageindex_s3_uri")
            if job and job.get("pageindex_s3_uri")
            else f"s3://{bucket_name}/{index_object_name}" if bucket_name else None
        )
        return {
            "doc_id": doc_id,
            "job_status": IndexStatus.COMPLETE.value,
            "index_status": IndexStatus.COMPLETE.value,
            "indexed": True,
            "page_index": page_index_payload,
            "pdf_storage_path": doc.get("pdf_storage_path") if doc else job.get("pdf_storage_path") if job else None,
            "pdf_s3_uri": doc.get("pdf_s3_uri") if doc else job.get("pdf_s3_uri") if job else None,
            "pageindex_s3_uri": pageindex_s3_uri,
            "storage_status": "uploaded",
        }

    if job:
        body: dict = {
            "doc_id": doc_id,
            "job_status": job["status"],
            "index_status": job["status"],
            "indexed": False,
            "page_index": None,
        }
        if job["status"] == IndexStatus.FAILED.value:
            body["error"] = job.get("error", "Unknown error")
            body["storage_error_message"] = job.get("error", "Unknown error")
            body["storage_status"] = "failed"
        return body

    return {
        "doc_id": doc_id,
        "job_status": IndexStatus.UNKNOWN.value,
        "index_status": IndexStatus.UNKNOWN.value,
        "indexed": False,
        "page_index": None,
        "message": "No job state in memory (server may have restarted). Re-upload if indexing never finished.",
    }


@app.get("/upload/{doc_id}/page-text")
async def get_upload_page_text(doc_id: str, pages: str = "1"):
    """Plain text for selected 1-based PDF page numbers (comma-separated), for RAG context fallback."""
    doc = None
    try:
        doc = await pageindex_documents_collection().find_one({"document_id": doc_id})
    except Exception:
        doc = None

    pdf_object_name = doc.get("pdf_storage_path") if doc else None
    job = jobs.get(doc_id)
    if not pdf_object_name and job:
        pdf_object_name = job.get("pdf_storage_path")
    if not pdf_object_name:
        user_id = doc.get("user_id") if doc else job.get("user_id") if job else None
        pdf_object_name = _pdf_object_name(doc_id, user_id)

    try:
        pdf_bytes = await asyncio.to_thread(download_bytes, pdf_object_name)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"PDF not found in S3 for doc_id: {exc}") from exc

    nums: list[int] = []
    for part in pages.split(","):
        part = part.strip()
        if part.isdigit():
            nums.append(int(part))
    if not nums:
        nums = [1]

    reader = PdfReader(io.BytesIO(pdf_bytes))
    total = len(reader.pages)
    out: list[dict] = []
    for p in nums:
        if 1 <= p <= total:
            text = reader.pages[p - 1].extract_text() or ""
            out.append({"page": p, "text": text})
    return {"pages": out}


@app.get("/catalog/page-index")
async def get_catalog_page_index(s3_uri: str):
    """Load a pre-indexed page_index.json from S3 by s3:// URI."""
    clean_uri = (s3_uri or "").strip()
    if not clean_uri:
        raise HTTPException(status_code=400, detail="s3_uri is required")

    object_name = object_key_from_s3_uri(clean_uri)
    if not object_name:
        raise HTTPException(status_code=400, detail="Invalid s3_uri")

    try:
        page_index_payload = await asyncio.to_thread(download_json, object_name)
    except S3StorageError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read catalog page index: {exc}",
        ) from exc

    return {
        "index_status": IndexStatus.COMPLETE.value,
        "indexed": True,
        "page_index": page_index_payload,
        "pageindex_s3_uri": clean_uri,
    }


@app.get("/catalog/page-text")
async def get_catalog_page_text(storage_path: str, pages: str = "1"):
    """Plain text for selected pages from a catalog PDF in S3."""
    clean_path = (storage_path or "").strip().lstrip("/")
    if not clean_path:
        raise HTTPException(status_code=400, detail="storage_path is required")

    try:
        pdf_bytes = await asyncio.to_thread(download_bytes, clean_path)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"PDF not found in S3: {exc}") from exc

    nums: list[int] = []
    for part in pages.split(","):
        part = part.strip()
        if part.isdigit():
            nums.append(int(part))
    if not nums:
        nums = [1]

    reader = PdfReader(io.BytesIO(pdf_bytes))
    total = len(reader.pages)
    out: list[dict] = []
    for p in nums:
        if 1 <= p <= total:
            text = reader.pages[p - 1].extract_text() or ""
            out.append({"page": p, "text": text})
    return {"pages": out}


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


@app.post("/chat/{doc_id}")
async def chat_with_document(doc_id: str, request: ChatRequest):
    """Send a message about an indexed PDF. Returns LLM answer and logs the interaction to logs/chat/."""
    doc = None
    try:
        doc = await pageindex_documents_collection().find_one({"document_id": doc_id})
    except Exception:
        doc = None

    job = jobs.get(doc_id)
    index_object_name = _resolve_index_object_key(doc_id, doc, job)

    try:
        page_index_data = await asyncio.to_thread(download_json, index_object_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Document indexing not complete yet: {exc}") from exc

    opt = ConfigLoader().load()
    structure_str = json.dumps(remove_fields(page_index_data, ["text"]), ensure_ascii=False)

    prompt = (
        "You are a helpful assistant answering questions about a document.\n\n"
        f"Document Structure:\n{structure_str}\n\n"
        f"User Question: {request.message}\n\n"
        "Answer the question based on the document structure above. "
        "Reference specific section titles and page ranges where relevant."
    )

    logger = ChatLogger(doc_id=doc_id, session_id=request.session_id)
    logger.log_user_message(request.message)

    answer = await asyncio.to_thread(
        llm_completion, opt.retrieve_model, prompt, logger=logger, operation="chat"
    )

    return {
        "session_id": logger.session_id,
        "doc_id": doc_id,
        "answer": answer,
        "token_stats": logger.log_data["token_stats"],
    }
