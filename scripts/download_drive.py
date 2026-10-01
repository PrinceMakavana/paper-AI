#!/usr/bin/env python3
"""Download a public Google Drive file or a nested folder tree.

Works with share links, uc?export=download URLs, or raw IDs. Folder links
are walked recursively. Already-downloaded files are skipped so a long run
can be resumed. Google Docs / Sheets / Slides are exported as PDF / xlsx / pptx.

Folder listing uses the Drive API when scripts/drive_credentials.json is
present; otherwise it parses the public folder page.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

DRIVE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{20,}$")
FILE_ID_PATTERNS = (
    re.compile(r"/file/d/([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/document/d/([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/spreadsheets/d/([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/presentation/d/([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"[?&]id=([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/uc\?.*?id=([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/open\?id=([A-Za-z0-9_-]+)", re.IGNORECASE),
)
FOLDER_ID_PATTERNS = (
    re.compile(r"/drive/folders/([A-Za-z0-9_-]+)", re.IGNORECASE),
    re.compile(r"/embeddedfolderview\?id=([A-Za-z0-9_-]+)", re.IGNORECASE),
)
CONFIRM_TOKEN_RE = re.compile(r"confirm=([0-9A-Za-z_-]+)")
DOWNLOAD_FORM_RE = re.compile(
    r'<form\b[^>]*\bid="download-form"[^>]*>(.*?)</form>',
    re.IGNORECASE | re.DOTALL,
)
FORM_ACTION_RE = re.compile(r'\baction="([^"]+)"', re.IGNORECASE)
INPUT_TAG_RE = re.compile(r"<input\b[^>]*>", re.IGNORECASE)
INPUT_NAME_RE = re.compile(r'\bname="([^"]+)"', re.IGNORECASE)
INPUT_VALUE_RE = re.compile(r'\bvalue="([^"]*)"', re.IGNORECASE)
FILENAME_RE = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', re.IGNORECASE)
PUBLIC_ENTRY_RE = re.compile(
    r'id="entry-([A-Za-z0-9_-]+)"[\s\S]*?class="flip-entry-title">([^<]+)',
    re.IGNORECASE,
)
PUBLIC_FOLDER_HREF_RE = re.compile(
    r'href="https://drive\.google\.com/drive/folders/([A-Za-z0-9_-]+)"',
    re.IGNORECASE,
)
GOOGLE_WORKSPACE_EXPORT = {
    "application/vnd.google-apps.document": (
        "application/pdf",
        ".pdf",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".pptx",
    ),
}
SKIP_WORKSPACE = {
    "application/vnd.google-apps.form",
    "application/vnd.google-apps.map",
    "application/vnd.google-apps.site",
    "application/vnd.google-apps.shortcut",
}
FOLDER_MIME = "application/vnd.google-apps.folder"


@dataclass
class ItemResult:
    status: str
    id: str
    name: str
    path: str
    detail: str = ""


class FolderLinkParser(HTMLParser):
    """Fallback collector for Drive IDs if regex parsing finds nothing."""

    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        href = dict(attrs).get("href") or ""
        parsed = parse_drive_target(href)
        if parsed:
            self.ids.add(parsed[1])


def parse_drive_target(value: str) -> tuple[str, str] | None:
    """Return ('file'|'folder', id) from a URL or raw ID."""
    text = (value or "").strip()
    if not text:
        return None
    if DRIVE_ID_RE.fullmatch(text):
        return ("file", text)
    for pattern in FOLDER_ID_PATTERNS:
        match = pattern.search(text)
        if match:
            return ("folder", match.group(1))
    for pattern in FILE_ID_PATTERNS:
        match = pattern.search(text)
        if match:
            return ("file", match.group(1))
    return None


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|]+", "_", name).strip(" .")
    return cleaned or "download"


def filename_from_headers(headers: Any, fallback: str) -> str:
    disposition = headers.get("Content-Disposition") or headers.get("content-disposition") or ""
    match = FILENAME_RE.search(disposition)
    if match:
        return safe_filename(urllib.parse.unquote(match.group(1)))
    return safe_filename(fallback)


def is_html_body(headers: Any, sample: bytes) -> bool:
    content_type = (headers.get("Content-Type") or headers.get("content-type") or "").lower()
    if "text/html" in content_type:
        return True
    return sample.lstrip().startswith((b"<!DOCTYPE", b"<html", b"<HTML"))


def extract_confirm_token(html: str, cookies: http.cookiejar.CookieJar) -> str | None:
    match = CONFIRM_TOKEN_RE.search(html)
    if match:
        return match.group(1)
    for cookie in cookies:
        if cookie.name.startswith("download_warning"):
            return cookie.value
    return None


def confirm_download_url(html: str, file_id: str, cookies: http.cookiejar.CookieJar) -> str | None:
    """Follow Drive's virus-scan interstitial to the real file URL.

    Large public files return an HTML form whose action is
    drive.usercontent.google.com, not drive.google.com/uc. Posting the
    confirm token back to /uc keeps returning that same page.
    """
    form = DOWNLOAD_FORM_RE.search(html)
    if form:
        action_match = FORM_ACTION_RE.search(form.group(0))
        action = action_match.group(1) if action_match else "https://drive.usercontent.google.com/download"
        params: dict[str, str] = {}
        for input_tag in INPUT_TAG_RE.findall(form.group(1)):
            name = INPUT_NAME_RE.search(input_tag)
            if not name:
                continue
            value = INPUT_VALUE_RE.search(input_tag)
            params[name.group(1)] = value.group(1) if value else ""
        params.setdefault("id", file_id)
        params.setdefault("export", "download")
        params.setdefault("confirm", "t")
        joiner = "&" if "?" in action else "?"
        return action + joiner + urllib.parse.urlencode(params)

    token = extract_confirm_token(html, cookies)
    if not token and 'name="uuid"' not in html:
        return None
    params = {"export": "download", "id": file_id, "confirm": token or "t"}
    uuid_match = re.search(r'name="uuid"\s+value="([^"]+)"', html)
    if uuid_match:
        params["uuid"] = uuid_match.group(1)
    return "https://drive.google.com/uc?" + urllib.parse.urlencode(params)


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    index = 2
    while True:
        candidate = path.with_name(f"{stem} ({index}){suffix}")
        if not candidate.exists():
            return candidate
        index += 1


class DriveDownloader:
    def __init__(
        self,
        timeout: int = 120,
        credentials: Path | None = None,
        token: Path | None = None,
        skip_existing: bool = True,
        sleep: float = 0.4,
    ):
        self.timeout = timeout
        self.credentials = credentials
        self.token = token
        self.skip_existing = skip_existing
        self.sleep = sleep
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self._drive_service: Any = None
        self.results: list[ItemResult] = []
        self.seen_ids: set[str] = set()
        self.file_index = 0

    def request(self, url: str) -> tuple[Any, bytes]:
        request = urllib.request.Request(url, headers=BROWSER_HEADERS)
        try:
            response = self.opener.open(request, timeout=self.timeout)
            chunk = response.read(8192)
            return response, chunk
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"HTTP {exc.code} for {url}: {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Failed to reach {url}: {exc.reason}") from exc
        except ssl.SSLError as exc:
            raise RuntimeError(f"SSL error for {url}: {exc}") from exc
        except TimeoutError as exc:
            raise RuntimeError(f"Timed out fetching {url}") from exc

    def _write_stream(self, path: Path, response: Any, sample: bytes) -> None:
        tmp = path.with_name(path.name + ".part")
        with tmp.open("wb") as handle:
            handle.write(sample)
            while True:
                chunk = response.read(1024 * 256)
                if not chunk:
                    break
                handle.write(chunk)
        tmp.replace(path)

    def download_file(
        self,
        file_id: str,
        dest_dir: Path,
        filename: str | None = None,
        mime_type: str | None = None,
    ) -> tuple[Path, str]:
        dest_dir.mkdir(parents=True, exist_ok=True)
        export = GOOGLE_WORKSPACE_EXPORT.get(mime_type or "")
        if export:
            _export_mime, suffix = export
            path = dest_dir / safe_filename(filename or f"{file_id}{suffix}")
            if not path.suffix:
                path = path.with_suffix(suffix)
            if self.skip_existing and path.exists() and path.stat().st_size > 0:
                return path, "skipped"
            self._download_export(file_id, path, mime_type or "")
            return path, "saved"

        if mime_type in SKIP_WORKSPACE:
            raise RuntimeError(f"Skipping unsupported Google type {mime_type}")

        guessed = dest_dir / safe_filename(filename) if filename else None
        if guessed and self.skip_existing and guessed.exists() and guessed.stat().st_size > 0:
            return guessed, "skipped"

        url = f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"
        response, sample = self.request(url)
        try:
            for _ in range(3):
                if not is_html_body(response.headers, sample):
                    break
                html = sample + response.read()
                response.close()
                text = html.decode("utf-8", errors="replace")
                url = confirm_download_url(text, file_id, self.cookies)
                if not url:
                    raise RuntimeError(
                        f"Drive returned an HTML page instead of a file for {file_id}."
                    )
                response, sample = self.request(url)
            if is_html_body(response.headers, sample):
                raise RuntimeError(
                    f"Drive did not return a file for {file_id} after the virus-scan confirm."
                )

            chosen = filename or filename_from_headers(response.headers, file_id)
            path = dest_dir / safe_filename(chosen)
            if self.skip_existing and path.exists() and path.stat().st_size > 0:
                return path, "skipped"
            if path.exists() and not self.skip_existing:
                path = unique_path(path)
            self._write_stream(path, response, sample)
            return path, "saved"
        finally:
            response.close()

    def _download_export(self, file_id: str, path: Path, mime_type: str) -> None:
        if mime_type == "application/vnd.google-apps.document":
            url = f"https://docs.google.com/document/d/{file_id}/export?format=pdf"
        elif mime_type == "application/vnd.google-apps.spreadsheet":
            url = f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx"
        elif mime_type == "application/vnd.google-apps.presentation":
            url = f"https://docs.google.com/presentation/d/{file_id}/export?format=pptx"
        else:
            raise RuntimeError(f"No export mapping for {mime_type}")

        response, sample = self.request(url)
        try:
            if is_html_body(response.headers, sample):
                raise RuntimeError(f"Could not export Google Workspace file {file_id}")
            self._write_stream(path, response, sample)
        finally:
            response.close()

    def drive_service(self) -> Any:
        if self._drive_service is not None:
            return self._drive_service
        if not self.credentials or not self.credentials.exists():
            raise RuntimeError(
                "Folder download needs Drive API credentials at "
                f"{self.credentials or 'scripts/drive_credentials.json'}"
            )
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
        except ImportError as exc:
            raise RuntimeError(
                "Install Drive API deps: pip install -r scripts/requirements-drive.txt"
            ) from exc

        creds = None
        if self.token and self.token.exists():
            creds = Credentials.from_authorized_user_file(str(self.token))
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                except Exception as exc:
                    raise RuntimeError(
                        f"Saved Drive token is invalid ({exc}). "
                        "Delete scripts/drive_token.json to re-auth, or use the public folder page."
                    ) from exc
            else:
                raise RuntimeError(
                    "Drive API token is missing or expired. "
                    "Public folder listing will be used instead."
                )
            if self.token:
                self.token.write_text(creds.to_json(), encoding="utf-8")
        self._drive_service = build("drive", "v3", credentials=creds)
        return self._drive_service

    def list_folder_api(self, folder_id: str) -> list[dict[str, str]]:
        service = self.drive_service()
        items: list[dict[str, str]] = []
        page_token = None
        query = f"'{folder_id}' in parents and trashed=false"
        while True:
            result = (
                service.files()
                .list(
                    q=query,
                    fields="nextPageToken, files(id, name, mimeType)",
                    pageSize=1000,
                    pageToken=page_token,
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    orderBy="folder,name",
                )
                .execute()
            )
            items.extend(result.get("files", []))
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        return items

    def list_folder_public(self, folder_id: str) -> list[dict[str, str]]:
        url = f"https://drive.google.com/embeddedfolderview?id={folder_id}#list"
        response, sample = self.request(url)
        try:
            html = (sample + response.read()).decode("utf-8", errors="replace")
        finally:
            response.close()

        items: list[dict[str, str]] = []
        seen: set[str] = set()
        for item_id, name in PUBLIC_ENTRY_RE.findall(html):
            if item_id == folder_id or item_id in seen:
                continue
            seen.add(item_id)
            href_folder = f"/drive/folders/{item_id}" in html
            items.append(
                {
                    "id": item_id,
                    "name": name.strip() or item_id,
                    "mimeType": FOLDER_MIME if href_folder else "",
                }
            )

        for item_id in PUBLIC_FOLDER_HREF_RE.findall(html):
            if item_id == folder_id or item_id in seen:
                continue
            seen.add(item_id)
            items.append({"id": item_id, "name": item_id, "mimeType": FOLDER_MIME})

        if not items:
            parser = FolderLinkParser()
            parser.feed(html)
            for item_id in sorted(parser.ids):
                if item_id == folder_id:
                    continue
                items.append({"id": item_id, "name": item_id, "mimeType": ""})

        if not items:
            raise RuntimeError(
                f"Could not list public folder {folder_id}. "
                "Share the folder as 'Anyone with the link', or add Drive API credentials."
            )
        return items

    def list_folder(self, folder_id: str) -> list[dict[str, str]]:
        if self.credentials:
            try:
                return self.list_folder_api(folder_id)
            except Exception as exc:
                self.credentials = None
                self._drive_service = None
                print(f"  Drive API unavailable ({exc}); using public folder page")
        return self.list_folder_public(folder_id)

    def get_file_meta(self, file_id: str) -> dict[str, str] | None:
        try:
            service = self.drive_service()
        except Exception:
            return None
        meta = (
            service.files()
            .get(fileId=file_id, fields="id, name, mimeType", supportsAllDrives=True)
            .execute()
        )
        return meta

    def record(self, status: str, item_id: str, name: str, path: Path | str, detail: str = "") -> None:
        self.results.append(
            ItemResult(status=status, id=item_id, name=name, path=str(path), detail=detail)
        )

    def download_tree(
        self,
        kind: str,
        target_id: str,
        dest_dir: Path,
        recursive: bool,
        folder_name: str | None = None,
    ) -> None:
        if target_id in self.seen_ids:
            return
        self.seen_ids.add(target_id)

        if kind == "folder":
            dest_dir.mkdir(parents=True, exist_ok=True)
            items = self.list_folder(target_id)
            label = folder_name or target_id
            print(f"Folder {label}: {len(items)} item(s) -> {dest_dir}")
            for item in items:
                item_id = item["id"]
                mime = item.get("mimeType") or ""
                name = item.get("name") or item_id
                if mime == FOLDER_MIME:
                    if not recursive:
                        print(f"  skip subfolder {name} (pass --recursive)")
                        self.record("skipped", item_id, name, dest_dir / safe_filename(name), "subfolder")
                        continue
                    self.download_tree(
                        "folder",
                        item_id,
                        dest_dir / safe_filename(name),
                        True,
                        folder_name=name,
                    )
                    continue
                self._download_one(item_id, dest_dir, name, mime)
            return

        meta = self.get_file_meta(target_id)
        if meta and meta.get("mimeType") == FOLDER_MIME:
            name = meta.get("name") or target_id
            self.download_tree("folder", target_id, dest_dir / safe_filename(name), recursive, name)
            return
        filename = meta.get("name") if meta else folder_name
        mime = meta.get("mimeType") if meta else None
        self._download_one(target_id, dest_dir, filename, mime)

    def _download_one(
        self,
        file_id: str,
        dest_dir: Path,
        filename: str | None,
        mime_type: str | None,
    ) -> None:
        name = filename or file_id
        self.file_index += 1
        try:
            path, status = self.download_file(
                file_id, dest_dir, filename=filename, mime_type=mime_type
            )
            if status == "skipped":
                print(f"  [{self.file_index}] skip {path.name}")
                self.record("skipped", file_id, name, path, "already exists")
            else:
                print(f"  [{self.file_index}] saved {path}")
                self.record("saved", file_id, name, path)
        except Exception as exc:
            print(f"  [{self.file_index}] error {name}: {exc}", file=sys.stderr)
            self.record("error", file_id, name, dest_dir / safe_filename(name), str(exc))
        if self.sleep:
            time.sleep(self.sleep)


def load_targets(values: list[str], url_file: Path | None) -> list[str]:
    targets = list(values)
    if url_file:
        for line in url_file.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text and not text.startswith("#"):
                targets.append(text)
    return targets


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download a public Google Drive file or nested folder tree."
    )
    parser.add_argument(
        "targets",
        nargs="*",
        help="Drive URL or file/folder ID (repeatable)",
    )
    parser.add_argument(
        "--url-file",
        help="Text file with one Drive URL or ID per line",
    )
    parser.add_argument(
        "--out",
        default="downloads/drive",
        help="Output directory (relative to project root unless absolute)",
    )
    parser.add_argument("--timeout", type=int, default=120, help="HTTP timeout in seconds")
    parser.add_argument(
        "--recursive",
        dest="recursive",
        action="store_true",
        default=True,
        help="Walk subfolders (default)",
    )
    parser.add_argument(
        "--no-recursive",
        dest="recursive",
        action="store_false",
        help="Download only the top-level folder",
    )
    parser.add_argument(
        "--skip-existing",
        dest="skip_existing",
        action="store_true",
        default=True,
        help="Skip files that already exist (default; safe to resume)",
    )
    parser.add_argument(
        "--overwrite",
        dest="skip_existing",
        action="store_false",
        help="Download again even if the local file exists",
    )
    parser.add_argument(
        "--credentials",
        default="scripts/drive_credentials.json",
        help="OAuth client secrets (optional; used for folder listing)",
    )
    parser.add_argument(
        "--token",
        default="scripts/drive_token.json",
        help="Saved OAuth token path",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.4,
        help="Pause between file downloads to avoid Drive rate limits",
    )
    parser.add_argument(
        "--report",
        default="downloads/drive_download_report.json",
        help="JSON report of saved / skipped / failed items",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    dest_dir = Path(args.out)
    if not dest_dir.is_absolute():
        dest_dir = root / dest_dir
    url_file = Path(args.url_file) if args.url_file else None
    if url_file and not url_file.is_absolute():
        url_file = root / url_file
    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = root / report_path

    raw_targets = load_targets(args.targets, url_file)
    if not raw_targets:
        parser.error("Provide at least one Drive URL/ID, or --url-file")

    credentials = root / args.credentials if not Path(args.credentials).is_absolute() else Path(args.credentials)
    token = root / args.token if not Path(args.token).is_absolute() else Path(args.token)

    downloader = DriveDownloader(
        timeout=args.timeout,
        credentials=credentials if credentials.exists() else None,
        token=token,
        skip_existing=args.skip_existing,
        sleep=args.sleep,
    )

    for index, raw in enumerate(raw_targets):
        parsed = parse_drive_target(raw)
        if not parsed:
            downloader.record("error", "", raw, dest_dir, "not a Google Drive URL or ID")
            print(f"skip: {raw} (not a Drive URL or ID)", file=sys.stderr)
            continue
        kind, target_id = parsed
        print(f"[{index + 1}/{len(raw_targets)}] {kind} {target_id}")
        try:
            downloader.download_tree(kind, target_id, dest_dir, args.recursive)
        except Exception as exc:
            downloader.record("error", target_id, raw, dest_dir, str(exc))
            print(f"error: {exc}", file=sys.stderr)

    counts = {"saved": 0, "skipped": 0, "error": 0}
    for result in downloader.results:
        counts[result.status] = counts.get(result.status, 0) + 1

    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(
            {
                "output_dir": str(dest_dir),
                "counts": counts,
                "items": [asdict(item) for item in downloader.results],
            },
            handle,
            indent=2,
            ensure_ascii=False,
        )
        handle.write("\n")

    print()
    print(f"Saved   : {counts['saved']}")
    print(f"Skipped : {counts['skipped']}")
    print(f"Failed  : {counts['error']}")
    print(f"Output  : {dest_dir}")
    print(f"Report  : {report_path}")
    if counts["error"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
