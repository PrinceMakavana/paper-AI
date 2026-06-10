import json
import os
import time
import logging
from typing import Any
from functools import wraps

# Configure logging
logger = logging.getLogger(__name__)

PDF_CONTENT_TYPE = "application/pdf"
JSON_CONTENT_TYPE = "application/json"


class S3StorageError(RuntimeError):
    pass


def _require_boto3():
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError as exc:
        raise S3StorageError(
            "boto3 is not installed. Run `pip install -r requirements.txt`."
        ) from exc

    return boto3, ClientError


def _bucket_name() -> str:
    bucket = os.getenv("AWS_S3_BUCKET_NAME", "").strip()
    if not bucket:
        raise S3StorageError("AWS_S3_BUCKET_NAME is required")
    return bucket


def _prefix() -> str:
    return os.getenv("AWS_S3_PREFIX", "pageindex").strip().strip("/") or "pageindex"


def _get_aws_region() -> str:
    return os.getenv("AWS_REGION", "us-east-1").strip()


def _get_retry_config() -> dict[str, Any]:
    """Get retry configuration from environment"""
    return {
        "max_retries": int(os.getenv("S3_MAX_RETRIES", "3")),
        "retry_delay": int(os.getenv("S3_RETRY_DELAY", "1")),
        "upload_timeout": int(os.getenv("S3_UPLOAD_TIMEOUT", "30")),
        "download_timeout": int(os.getenv("S3_DOWNLOAD_TIMEOUT", "30")),
    }


def _safe_path_part(value: str | None, fallback: str) -> str:
    clean = (value or fallback).strip().replace("\\", "-").replace("/", "-")
    return clean or fallback


def retry_with_backoff(max_retries: int = 3, initial_delay: int = 1):
    """Decorator for retrying S3 operations with exponential backoff"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    boto3, ClientError = _require_boto3()
                    
                    # Don't retry on auth or validation errors
                    if isinstance(e, ClientError):
                        error_code = e.response.get("Error", {}).get("Code", "")
                        if error_code in {"InvalidAccessKeyId", "AccessDenied", "SignatureDoesNotMatch", "NoSuchBucket"}:
                            logger.error(f"S3 operation failed with non-retryable error: {error_code}")
                            raise
                    
                    if attempt < max_retries - 1:
                        logger.warning(f"S3 operation failed (attempt {attempt + 1}/{max_retries}), retrying in {delay}s: {str(e)}")
                        time.sleep(delay)
                        delay = min(delay * 2, 32)  # Exponential backoff with max 32s
                    else:
                        logger.error(f"S3 operation failed after {max_retries} attempts: {str(e)}")
            
            raise last_exception or S3StorageError("S3 operation failed after retries")
        return wrapper
    return decorator


def build_object_name(user_id: str | None, doc_id: str, filename: str) -> str:
    safe_user_id = _safe_path_part(user_id, "anonymous")
    safe_doc_id = _safe_path_part(doc_id, "document")
    return f"{_prefix()}/{safe_user_id}/{safe_doc_id}/{filename}"


def _client():
    boto3, _ = _require_boto3()
    region = _get_aws_region()
    return boto3.client("s3", region_name=region)


@retry_with_backoff(max_retries=3, initial_delay=1)
def upload_bytes(data: bytes, object_name: str, content_type: str) -> dict[str, str]:
    bucket_name = _bucket_name()
    logger.info(f"Uploading {len(data)} bytes to S3: s3://{bucket_name}/{object_name}")
    
    try:
        _client().put_object(
            Bucket=bucket_name,
            Key=object_name,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"Successfully uploaded to S3: s3://{bucket_name}/{object_name}")
    except Exception as e:
        logger.error(f"Failed to upload to S3 {object_name}: {str(e)}")
        raise
    
    return {
        "storage_path": object_name,
        "s3_uri": f"s3://{bucket_name}/{object_name}",
    }


def upload_json(payload: Any, object_name: str) -> dict[str, str]:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    logger.info(f"Uploading JSON ({len(data)} bytes) to S3: {object_name}")
    return upload_bytes(data, object_name, JSON_CONTENT_TYPE)


@retry_with_backoff(max_retries=3, initial_delay=1)
def object_exists(object_name: str) -> bool:
    _, ClientError = _require_boto3()
    bucket_name = _bucket_name()
    
    try:
        _client().head_object(Bucket=bucket_name, Key=object_name)
        logger.debug(f"S3 object exists: s3://{bucket_name}/{object_name}")
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"404", "NoSuchKey", "NotFound"}:
            logger.debug(f"S3 object not found: s3://{bucket_name}/{object_name}")
            return False
        logger.error(f"Error checking S3 object existence {object_name}: {str(exc)}")
        raise


@retry_with_backoff(max_retries=3, initial_delay=1)
def download_bytes(object_name: str) -> bytes:
    bucket_name = _bucket_name()
    logger.info(f"Downloading from S3: s3://{bucket_name}/{object_name}")
    
    try:
        response = _client().get_object(Bucket=bucket_name, Key=object_name)
        data = response["Body"].read()
        logger.info(f"Successfully downloaded {len(data)} bytes from S3: {object_name}")
        return data
    except Exception as e:
        logger.error(f"Failed to download from S3 {object_name}: {str(e)}")
        raise


def download_json(object_name: str) -> Any:
    logger.info(f"Downloading JSON from S3: {object_name}")
    data = download_bytes(object_name)
    return json.loads(data.decode("utf-8"))


@retry_with_backoff(max_retries=3, initial_delay=1)
def delete_object(object_name: str) -> None:
    """Delete an object from S3 bucket"""
    bucket_name = _bucket_name()
    logger.info(f"Deleting S3 object: s3://{bucket_name}/{object_name}")
    
    try:
        _client().delete_object(Bucket=bucket_name, Key=object_name)
        logger.info(f"Successfully deleted S3 object: {object_name}")
    except Exception as e:
        logger.error(f"Failed to delete S3 object {object_name}: {str(e)}")
        raise


def list_objects(prefix: str = "") -> list[dict[str, Any]]:
    """List objects in S3 bucket with optional prefix"""
    bucket_name = _bucket_name()
    full_prefix = f"{_prefix()}/{prefix}".rstrip("/")
    logger.info(f"Listing S3 objects with prefix: {full_prefix}")
    
    try:
        response = _client().list_objects_v2(Bucket=bucket_name, Prefix=full_prefix)
        objects = response.get("Contents", [])
        logger.info(f"Found {len(objects)} objects with prefix {full_prefix}")
        return objects
    except Exception as e:
        logger.error(f"Failed to list S3 objects with prefix {full_prefix}: {str(e)}")
        raise


def check_connection() -> dict[str, Any]:
    """Check S3 connection and return connection details"""
    bucket_name = _bucket_name()
    region = _get_aws_region()
    
    try:
        _client().head_bucket(Bucket=bucket_name)
        logger.info(f"Successfully connected to S3 bucket: {bucket_name} in region {region}")
        return {
            "connected": True,
            "bucket": bucket_name,
            "prefix": _prefix(),
            "region": region,
        }
    except Exception as e:
        logger.error(f"Failed to connect to S3 bucket {bucket_name}: {str(e)}")
        raise S3StorageError(f"S3 connection failed: {str(e)}")
