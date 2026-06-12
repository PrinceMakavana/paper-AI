#!/usr/bin/env python3
"""Batch-index catalog books for GTU subjects via POST /pageindex/upload."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import boto3
import requests

TERMINAL_STATUSES = frozenset({"complete", "failed"})

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_subject(data_dir: Path, subject_code: str) -> tuple[Path, dict[str, Any]]:
    path = data_dir / f"{subject_code}.json"
    if not path.exists():
        raise FileNotFoundError(f"Subject file not found: {path}")

    subject = json.loads(path.read_text(encoding="utf-8"))
    code_in_file = str(subject.get("subjecet_code") or "").strip()
    if code_in_file and code_in_file != subject_code:
        raise ValueError(
            f"Subject code mismatch in {subject_code}.json "
            f"(expected {subject_code}, found {code_in_file})"
        )
    return path, subject


def pick_book(subject: dict[str, Any], book_index: int) -> dict[str, Any]:
    books = subject.get("Books") or []
    if not books:
        raise ValueError("No books in subject file")
    if book_index < 0 or book_index >= len(books):
        raise IndexError(f"Book index {book_index} out of range (0..{len(books) - 1})")
    return books[book_index]


def book_id_for(subject_code: str, book_index: int) -> str:
    return f"{subject_code}-{book_index}"


def extract_drive_file_id(url: str) -> str | None:
    url = url.strip()
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.query:
        file_id = parse_qs(parsed.query).get("id", [None])[0]
        if file_id:
            return file_id

    match = re.search(r"/file/d/([^/]+)/", url)
    if match:
        return match.group(1)

    return None


def download_google_drive_pdf(url: str, session: requests.Session, timeout: int = 180) -> bytes:
    file_id = extract_drive_file_id(url)
    if not file_id:
        raise ValueError(f"Could not parse Google Drive file id from: {url}")

    base = f"https://drive.google.com/uc?export=download&id={file_id}"
    response = session.get(base, stream=True, timeout=timeout, headers=BROWSER_HEADERS)
    response.raise_for_status()

    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            response = session.get(
                base,
                params={"confirm": value},
                stream=True,
                timeout=timeout,
                headers=BROWSER_HEADERS,
            )
            response.raise_for_status()
            break

    data = response.content
    if not data.startswith(b"%PDF"):
        raise ValueError(
            "Downloaded file is not a PDF (Drive link may be broken or require login)"
        )
    return data


def upload_pdf(
    api_url: str,
    token: str,
    pdf_bytes: bytes,
    filename: str,
    timeout: int = 180,
) -> str:
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": (filename, pdf_bytes, "application/pdf")}
    response = requests.post(
        f"{api_url.rstrip('/')}/pageindex/upload",
        headers=headers,
        files=files,
        timeout=timeout,
    )
    if not response.ok:
        detail = response.text.strip()
        raise RuntimeError(f"Upload failed ({response.status_code}): {detail}")

    payload = response.json()
    document_id = payload.get("documentId")
    if not document_id:
        raise RuntimeError(f"Upload response missing documentId: {payload}")
    return document_id


def wait_for_index(
    api_url: str,
    token: str,
    document_id: str,
    poll_interval: int,
    poll_timeout: int,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{api_url.rstrip('/')}/pageindex/documents/{document_id}/status"
    deadline = time.time() + poll_timeout

    while time.time() < deadline:
        response = requests.get(url, headers=headers, timeout=60)
        if not response.ok:
            detail = response.text.strip()
            raise RuntimeError(f"Status poll failed ({response.status_code}): {detail}")

        data = response.json()
        status = (data.get("indexStatus") or "").lower()
        print(
            f"  [{document_id}] indexStatus={status}, "
            f"jobStatus={data.get('jobStatus')}, step={data.get('currentStep')}"
        )

        if status in TERMINAL_STATUSES:
            if status != "complete":
                raise RuntimeError(f"Indexing failed: {data.get('error') or data}")
            return data

        time.sleep(poll_interval)

    raise TimeoutError(f"Timed out waiting for document {document_id}")


def parse_s3_uri(s3_uri: str) -> tuple[str, str]:
    if not s3_uri.startswith("s3://"):
        raise ValueError(f"Invalid s3 uri: {s3_uri}")
    rest = s3_uri[5:]
    bucket, _, key = rest.partition("/")
    if not bucket or not key:
        raise ValueError(f"Invalid s3 uri: {s3_uri}")
    return bucket, key


def copy_index_to_catalog(
    source_s3_uri: str,
    subject_code: str,
    book_index: int,
    bucket_override: str | None = None,
) -> tuple[str, int]:
    src_bucket, src_key = parse_s3_uri(source_s3_uri)
    bucket = bucket_override or src_bucket
    dest_book_id = book_id_for(subject_code, book_index)
    dest_key = f"pageindex/books/{subject_code}/{dest_book_id}-page_index.json"

    client = boto3.client("s3")
    client.copy_object(
        Bucket=bucket,
        CopySource={"Bucket": src_bucket, "Key": src_key},
        Key=dest_key,
        ContentType="application/json",
    )

    head = client.head_object(Bucket=bucket, Key=dest_key)
    dest_uri = f"s3://{bucket}/{dest_key}"
    return dest_uri, int(head["ContentLength"])


def count_ready_books(books: list[dict[str, Any]]) -> int:
    return sum(
        1
        for book in books
        if book.get("pageindex_status") == "ready" and book.get("pageindex_s3_uri")
    )


def resolve_subject_pageindex_status(ready_count: int, book_count: int) -> str:
    if ready_count == 0:
        return "pending"
    if ready_count >= book_count:
        return "ready"
    return "partial"


def update_subject_json(
    path: Path,
    subject_code: str,
    book_index: int,
    catalog_s3_uri: str,
    size_bytes: int,
) -> None:
    subject = json.loads(path.read_text(encoding="utf-8"))
    books = subject.setdefault("Books", [])
    if book_index >= len(books):
        raise IndexError(f"Book index {book_index} out of range")

    dest_book_id = book_id_for(subject_code, book_index)
    book = books[book_index]
    book.setdefault("book_id", dest_book_id)
    if not book.get("title") and book.get("alt_data"):
        book["title"] = str(book["alt_data"]).strip()

    book["pageindex_status"] = "ready"
    book["pageindex_s3_uri"] = catalog_s3_uri
    book["pageindex_size_bytes"] = size_bytes
    book["indexed_at"] = date.today().isoformat()
    book["index_version"] = 1

    ready_count = count_ready_books(books)
    subject["chat_mode"] = "subject"
    subject["primary_book_id"] = dest_book_id
    subject["indexed_book_count"] = ready_count
    subject["pageindex_status"] = resolve_subject_pageindex_status(ready_count, len(books))

    temp_path = path.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps(subject, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temp_path.replace(path)


def process_subject(
    subject_code: str,
    *,
    data_dir: Path,
    api_url: str,
    token: str,
    bucket: str | None,
    book_index: int,
    skip_ready: bool,
    dry_run: bool,
    poll_interval: int,
    poll_timeout: int,
    session: requests.Session,
) -> dict[str, Any]:
    path, subject = load_subject(data_dir, subject_code)
    book = pick_book(subject, book_index)
    dest_book_id = book_id_for(subject_code, book_index)

    if skip_ready and book.get("pageindex_status") == "ready" and book.get("pageindex_s3_uri"):
        return {
            "subject_code": subject_code,
            "status": "skipped",
            "reason": "already indexed",
            "book_id": dest_book_id,
        }

    download_link = (book.get("download_link") or "").strip()
    if not download_link:
        return {
            "subject_code": subject_code,
            "status": "error",
            "error": "missing download_link",
            "book_id": dest_book_id,
        }

    subject_name = subject.get("subject_name") or subject_code
    print(f"\n=== {subject_code} ({subject_name}) book={dest_book_id} ===")

    if dry_run:
        return {
            "subject_code": subject_code,
            "status": "dry_run",
            "book_id": dest_book_id,
            "download_link": download_link,
            "subject_name": subject_name,
        }

    pdf_bytes = download_google_drive_pdf(download_link, session)
    filename = f"{subject_code}-{dest_book_id}.pdf"
    print(f"  Downloaded PDF ({len(pdf_bytes)} bytes)")

    document_id = upload_pdf(api_url, token, pdf_bytes, filename)
    print(f"  Upload accepted, documentId={document_id}")

    status_payload = wait_for_index(
        api_url,
        token,
        document_id,
        poll_interval,
        poll_timeout,
    )

    doc = status_payload.get("document") or {}
    source_uri = doc.get("pageindexS3Uri") or doc.get("pageindex_s3_uri")
    if not source_uri:
        raise RuntimeError("Status response missing pageindex S3 URI")

    catalog_uri, size_bytes = copy_index_to_catalog(
        source_uri,
        subject_code,
        book_index,
        bucket,
    )
    print(f"  Copied index to {catalog_uri} ({size_bytes} bytes)")

    update_subject_json(path, subject_code, book_index, catalog_uri, size_bytes)
    print(f"  Updated {path}")

    return {
        "subject_code": subject_code,
        "status": "ok",
        "book_id": dest_book_id,
        "document_id": document_id,
        "source_pageindex_s3_uri": source_uri,
        "catalog_pageindex_s3_uri": catalog_uri,
        "size_bytes": size_bytes,
    }


def resolve_token(args_token: str | None) -> str:
    token = (args_token or os.environ.get("PAPERAI_TOKEN") or "").strip()
    if not token:
        raise SystemExit("JWT token required: pass --token or set PAPERAI_TOKEN")
    return token


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Batch index catalog subject books via POST /pageindex/upload",
    )
    parser.add_argument(
        "--subjects",
        nargs="+",
        required=True,
        help="Subject codes, e.g. 3150614 3140708 3141005",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="JWT Bearer token (or set PAPERAI_TOKEN env var)",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:5000",
        help="Express backend base URL",
    )
    parser.add_argument(
        "--data-dir",
        default=str(project_root() / "data"),
        help="Folder with subject JSON files",
    )
    parser.add_argument(
        "--bucket",
        default=None,
        help="Override S3 bucket for catalog copy (default: source bucket)",
    )
    parser.add_argument(
        "--book-index",
        type=int,
        default=0,
        help="Which book in Books[] to index (default: 0)",
    )
    parser.add_argument(
        "--skip-ready",
        action="store_true",
        help="Skip if chosen book already has pageindex_status ready",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate files/links only; no upload or S3 writes",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=20,
        help="Seconds between status polls (default: 20)",
    )
    parser.add_argument(
        "--poll-timeout",
        type=int,
        default=2700,
        help="Max wait per subject in seconds (default: 2700 = 45 min)",
    )
    parser.add_argument(
        "--report",
        default="batch_index_report.json",
        help="Per-run JSON report path (default: batch_index_report.json)",
    )
    args = parser.parse_args()

    token = resolve_token(args.token)
    data_dir = Path(args.data_dir)
    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = project_root() / report_path

    session = requests.Session()
    results: list[dict[str, Any]] = []

    for raw_code in args.subjects:
        subject_code = raw_code.strip()
        if not subject_code:
            continue
        try:
            results.append(
                process_subject(
                    subject_code,
                    data_dir=data_dir,
                    api_url=args.api_url,
                    token=token,
                    bucket=args.bucket,
                    book_index=args.book_index,
                    skip_ready=args.skip_ready,
                    dry_run=args.dry_run,
                    poll_interval=args.poll_interval,
                    poll_timeout=args.poll_timeout,
                    session=session,
                )
            )
        except Exception as exc:
            print(f"ERROR {subject_code}: {exc}", file=sys.stderr)
            results.append({
                "subject_code": subject_code,
                "status": "error",
                "error": str(exc),
            })

    report_path.write_text(
        json.dumps(results, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    ok_statuses = {"ok", "skipped", "dry_run"}
    success = all(item.get("status") in ok_statuses for item in results)

    print("\n" + "=" * 60)
    print(f"Subjects processed : {len(results)}")
    print(f"OK                 : {sum(1 for r in results if r.get('status') == 'ok')}")
    print(f"Skipped            : {sum(1 for r in results if r.get('status') == 'skipped')}")
    print(f"Dry run            : {sum(1 for r in results if r.get('status') == 'dry_run')}")
    print(f"Errors             : {sum(1 for r in results if r.get('status') == 'error')}")
    print(f"\nReport saved to    : {report_path}")

    return 0 if success else 1


if __name__ == "__main__":
    raise SystemExit(main())
