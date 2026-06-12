#!/usr/bin/env python3
"""Upload a local file to Google Drive and replace a broken URL in subject JSON."""

from __future__ import annotations

import argparse
import json
import mimetypes
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

SCOPES = ("https://www.googleapis.com/auth/drive.file",)
FIELD_SEGMENT = re.compile(r"^([^\[]+)(?:\[(\d+)\])?$")


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_local_path(raw_path: str) -> Path:
    parsed = urlparse(raw_path.strip())
    if parsed.scheme == "file":
        return Path(unquote(parsed.path))
    return Path(raw_path.strip()).expanduser()


def parse_field_segment(segment: str) -> tuple[str, int | None]:
    match = FIELD_SEGMENT.fullmatch(segment)
    if not match:
        raise ValueError(f"Invalid field path segment: {segment!r}")
    key = match.group(1)
    index = int(match.group(2)) if match.group(2) is not None else None
    return key, index


def get_field_value(data: Any, field_path: str) -> Any:
    obj = data
    for segment in field_path.split("."):
        key, index = parse_field_segment(segment)
        obj = obj[key]
        if index is not None:
            obj = obj[index]
    return obj


def set_field_value(data: Any, field_path: str, value: str) -> None:
    segments = field_path.split(".")
    obj = data
    for segment in segments[:-1]:
        key, index = parse_field_segment(segment)
        obj = obj[key]
        if index is not None:
            obj = obj[index]

    last_key, last_index = parse_field_segment(segments[-1])
    if last_index is not None:
        obj[last_key][last_index] = value
    else:
        obj[last_key] = value


def drive_download_url(file_id: str) -> str:
    return f"https://drive.google.com/uc?export=download&id={file_id}"


def drive_view_url(file_id: str) -> str:
    return f"https://drive.google.com/file/d/{file_id}/view?usp=sharing"


def get_drive_service(credentials_path: Path, token_path: Path):
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise SystemExit(
            "Google Drive libraries are required. Install with:\n"
            "  pip install -r scripts/requirements-drive.txt"
        ) from exc

    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise SystemExit(
                    f"Missing OAuth credentials file: {credentials_path}\n"
                    "Create a Google Cloud OAuth Desktop client JSON and save it there.\n"
                    "Enable the Google Drive API for your project first."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return build("drive", "v3", credentials=creds)


def upload_and_share(
    service,
    local_path: Path,
    folder_id: str | None,
    use_view_url: bool,
) -> tuple[str, str]:
    from googleapiclient.http import MediaFileUpload

    if not local_path.is_file():
        raise FileNotFoundError(f"Local file not found: {local_path}")

    mime_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
    metadata: dict[str, Any] = {"name": local_path.name}
    if folder_id:
        metadata["parents"] = [folder_id]

    media = MediaFileUpload(str(local_path), mimetype=mime_type, resumable=True)
    created = (
        service.files()
        .create(body=metadata, media_body=media, fields="id,name,webViewLink")
        .execute()
    )
    file_id = created["id"]

    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
    ).execute()

    public_url = drive_view_url(file_id) if use_view_url else drive_download_url(file_id)
    return file_id, public_url


def load_entry(args: argparse.Namespace) -> dict[str, Any]:
    if args.entry_json:
        return json.loads(args.entry_json)

    if args.entry_file:
        with Path(args.entry_file).open(encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict) and "broken" in payload:
            return payload["broken"]
        if isinstance(payload, dict) and "file" in payload and "field" in payload:
            return payload
        raise SystemExit("Entry file must be a broken-link object or {\"broken\": {...}}.")

    if not args.subject_file or not args.field:
        raise SystemExit("Provide --entry-json / --entry-file, or --subject-file with --field.")

    entry = {
        "file": args.subject_file,
        "field": args.field,
    }
    if args.old_url:
        entry["url"] = args.old_url
    return entry


def append_fix_log(log_path: Path, record: dict[str, Any]) -> None:
    existing: list[dict[str, Any]] = []
    if log_path.exists():
        with log_path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
            if isinstance(payload, list):
                existing = payload
    existing.append(record)
    with log_path.open("w", encoding="utf-8") as handle:
        json.dump(existing, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def fix_one(
    entry: dict[str, Any],
    local_path: Path,
    data_dir: Path,
    service,
    folder_id: str | None,
    use_view_url: bool,
    dry_run: bool,
    force: bool,
) -> dict[str, Any]:
    subject_name = entry["file"]
    field_path = entry["field"]
    old_url = entry.get("url")

    subject_path = data_dir / subject_name
    if not subject_path.exists():
        raise FileNotFoundError(f"Subject file not found: {subject_path}")

    with subject_path.open(encoding="utf-8") as handle:
        subject_data = json.load(handle)

    current_url = get_field_value(subject_data, field_path)
    if old_url and current_url != old_url and not force:
        raise ValueError(
            f"URL mismatch in {subject_name} at {field_path}.\n"
            f"  expected: {old_url}\n"
            f"  current : {current_url}\n"
            "Use --force to replace anyway."
        )

    if dry_run:
        return {
            "subject_file": subject_name,
            "field": field_path,
            "old_url": current_url,
            "local_file": str(local_path),
            "dry_run": True,
        }

    file_id, public_url = upload_and_share(service, local_path, folder_id, use_view_url)
    set_field_value(subject_data, field_path, public_url)

    with subject_path.open("w", encoding="utf-8") as handle:
        json.dump(subject_data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    return {
        "subject_file": subject_name,
        "field": field_path,
        "old_url": current_url,
        "new_url": public_url,
        "drive_file_id": file_id,
        "drive_view_url": drive_view_url(file_id),
        "local_file": str(local_path),
        "dry_run": False,
    }


def load_batch(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, list):
        raise SystemExit("Batch file must be a JSON array.")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Upload a local PDF/file to Google Drive and fix a broken subject URL."
    )
    parser.add_argument(
        "--local-file",
        help="Local file path (supports file:///... URLs). Required unless using --batch.",
    )
    parser.add_argument(
        "--entry-json",
        help='Broken-link object JSON, e.g. {"file":"2150704.json","field":"Books[1].download_link","url":"..."}',
    )
    parser.add_argument(
        "--entry-file",
        help="Path to JSON file containing a broken-link object.",
    )
    parser.add_argument("--subject-file", help="Subject JSON filename, e.g. 2150704.json")
    parser.add_argument("--field", help='Field path, e.g. Books[1].download_link')
    parser.add_argument("--old-url", help="Expected current broken URL (optional safety check)")
    parser.add_argument(
        "--batch",
        help="JSON array of {\"broken\": {...}, \"local_file\": \"...\"} items",
    )
    parser.add_argument("--data-dir", default="data", help="Subject JSON folder")
    parser.add_argument(
        "--credentials",
        default="scripts/drive_credentials.json",
        help="Google OAuth client secrets JSON",
    )
    parser.add_argument(
        "--token",
        default="scripts/drive_token.json",
        help="Saved OAuth token JSON",
    )
    parser.add_argument(
        "--folder-id",
        help="Optional Google Drive folder ID to upload into",
    )
    parser.add_argument(
        "--view-url",
        action="store_true",
        help="Store view link instead of direct download link",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate only; do not upload or write")
    parser.add_argument("--force", action="store_true", help="Replace even if current URL differs")
    parser.add_argument(
        "--log",
        default="scripts/link_fix_log.json",
        help="Append fix history to this JSON log",
    )
    args = parser.parse_args()

    root = project_root()
    data_dir = root / args.data_dir
    credentials_path = root / args.credentials
    token_path = root / args.token
    log_path = root / args.log

    service = None
    if not args.dry_run:
        service = get_drive_service(credentials_path, token_path)

    results: list[dict[str, Any]] = []

    if args.batch:
        batch_items = load_batch(root / args.batch if not Path(args.batch).is_absolute() else Path(args.batch))
        for index, item in enumerate(batch_items, start=1):
            entry = item.get("broken") or item
            local_raw = item.get("local_file")
            if not local_raw:
                raise SystemExit(f"Batch item #{index} is missing local_file.")
            local_path = normalize_local_path(local_raw)
            print(f"[{index}/{len(batch_items)}] {entry.get('file')} :: {entry.get('field')}")
            result = fix_one(
                entry=entry,
                local_path=local_path,
                data_dir=data_dir,
                service=service,
                folder_id=args.folder_id,
                use_view_url=args.view_url,
                dry_run=args.dry_run,
                force=args.force,
            )
            results.append(result)
            if result.get("new_url"):
                print(f"  updated -> {result['new_url']}")
            else:
                print("  dry-run ok")
    else:
        if not args.local_file:
            raise SystemExit("--local-file is required unless --batch is used.")
        entry = load_entry(args)
        local_path = normalize_local_path(args.local_file)
        result = fix_one(
            entry=entry,
            local_path=local_path,
            data_dir=data_dir,
            service=service,
            folder_id=args.folder_id,
            use_view_url=args.view_url,
            dry_run=args.dry_run,
            force=args.force,
        )
        results.append(result)
        if result.get("new_url"):
            print(f"Updated {result['subject_file']} :: {result['field']}")
            print(f"  old: {result['old_url']}")
            print(f"  new: {result['new_url']}")
        else:
            print("Dry-run OK:")
            print(json.dumps(result, indent=2))

    if not args.dry_run:
        for result in results:
            append_fix_log(log_path, result)
        print(f"\nFix log appended to {log_path}")


if __name__ == "__main__":
    main()
