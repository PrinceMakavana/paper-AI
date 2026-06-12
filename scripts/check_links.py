#!/usr/bin/env python3
"""Audit URLs in subject JSON files and report broken / blocked / moved links."""

from __future__ import annotations

import argparse
import json
import re
import ssl
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

GTU_HOSTS = ("gtu.ac.in", "www.gtu.ac.in")

# Fields that usually hold download/page links (not thumbnails)
LINK_FIELDS = {
    "syllabus",
    "link",
    "download_link",
    "paper_solution",
    "prectical",
    "viva_questions",
    "imp_material",
    "assignments",
}


@dataclass
class LinkResult:
    file: str
    field: str
    url: str
    status: str          # ok | redirect | broken | blocked | unreachable
    http_code: int | None
    final_url: str | None
    detail: str


def collect_urls(obj: Any, path: str = "") -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []

    if isinstance(obj, dict):
        for key, value in obj.items():
            child_path = f"{path}.{key}" if path else key
            found.extend(collect_urls(value, child_path))
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            found.extend(collect_urls(value, f"{path}[{index}]"))
    elif isinstance(obj, str):
        match = URL_PATTERN.search(obj.strip())
        if match:
            found.append((path, match.group(0).rstrip(".,;)")))

    return found


def should_check(field: str, skip_images: bool) -> bool:
    leaf = field.split(".")[-1].split("[")[0]
    if skip_images and leaf == "img":
        return False
    return True


def is_gtu_host(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host in GTU_HOSTS or host.endswith(".gtu.ac.in")


def request_headers(url: str, method: str) -> dict[str, str]:
    headers = dict(BROWSER_HEADERS)
    if is_gtu_host(url):
        headers["Referer"] = "https://gtu.ac.in/"
    if method == "GET" and url.lower().split("?", 1)[0].endswith(".pdf"):
        headers["Range"] = "bytes=0-0"
    return headers


def classify(http_code: int | None, error: str | None, original: str, final: str | None) -> str:
    if http_code is None:
        lowered = (error or "").lower()
        if any(x in lowered for x in ("403", "forbidden", "blocked")):
            return "blocked"
        if any(x in lowered for x in ("timed out", "timeout", "name or service not known", "nodename")):
            return "unreachable"
        if any(x in lowered for x in ("connection refused", "reset", "ssl", "certificate")):
            return "unreachable"
        return "unreachable"

    # 206 = partial content (Range request on PDF); treat as reachable
    if http_code == 206:
        return "ok"

    if 200 <= http_code < 300:
        if final and final.rstrip("/") != original.rstrip("/"):
            return "redirect"
        return "ok"

    if 300 <= http_code < 400:
        return "redirect"

    if http_code == 403:
        return "blocked"

    if http_code == 404:
        return "broken"

    if 400 <= http_code < 500:
        return "broken"

    if http_code >= 500:
        return "broken"

    return "broken"


def check_url(url: str, timeout: int) -> tuple[int | None, str | None, str | None]:
    # GTU blocks HEAD and bot User-Agents; use browser GET only
    methods = ("GET",) if is_gtu_host(url) else ("HEAD", "GET")

    for method in methods:
        headers = request_headers(url, method)
        request = urllib.request.Request(url, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.status, None, response.geturl()
        except urllib.error.HTTPError as exc:
            # Some servers reject HEAD but accept GET
            if method == "HEAD" and exc.code in (403, 405, 501):
                continue
            return exc.code, str(exc.reason), exc.geturl()
        except urllib.error.URLError as exc:
            if method == "GET":
                return None, str(exc.reason), None
        except ssl.SSLError as exc:
            return None, f"SSL error: {exc}", None
        except TimeoutError:
            return None, "Timed out", None
        except Exception as exc:
            return None, str(exc), None

    return None, "Request failed", None


def audit_file(path: Path, timeout: int, skip_images: bool) -> list[LinkResult]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)

    results: list[LinkResult] = []
    seen: set[tuple[str, str]] = set()

    for field, url in collect_urls(data):
        if not should_check(field, skip_images):
            continue

        key = (field, url)
        if key in seen:
            continue
        seen.add(key)

        http_code, error, final_url = check_url(url, timeout)
        status = classify(http_code, error, url, final_url)

        detail = error or f"HTTP {http_code}"
        if status == "redirect" and final_url:
            detail = f"redirects to {final_url}"

        results.append(
            LinkResult(
                file=path.name,
                field=field,
                url=url,
                status=status,
                http_code=http_code,
                final_url=final_url,
                detail=detail,
            )
        )

    return results


def print_result(result: LinkResult) -> None:
    label = result.status.upper()
    print(f"[{label}] {result.file}")
    print(f"  field : {result.field}")
    print(f"  url   : {result.url}")
    if result.http_code is not None:
        print(f"  code  : {result.http_code}")
    print(f"  detail: {result.detail}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audit subject JSON files and find broken/blocked/moved URLs."
    )
    parser.add_argument("--data-dir", default="data", help="Folder with subject JSON files")
    parser.add_argument("--timeout", type=int, default=20, help="Request timeout in seconds")
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Skip img/thumbnail URLs (recommended)",
    )
    parser.add_argument(
        "--broken-only",
        action="store_true",
        help="Print only non-ok links",
    )
    parser.add_argument(
        "--report",
        default="link_audit_report.json",
        help="Output JSON report path (relative to project root)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    data_dir = root / args.data_dir
    report_path = root / args.report

    if not data_dir.exists():
        raise SystemExit(f"Data directory not found: {data_dir}")

    all_results: list[LinkResult] = []

    print(f"Scanning {data_dir} ...\n")

    for json_path in sorted(data_dir.glob("*.json")):
        file_results = audit_file(json_path, args.timeout, args.skip_images)
        all_results.extend(file_results)

        for result in file_results:
            if args.broken_only and result.status == "ok":
                continue
            print_result(result)

    counts = {
        "ok": 0,
        "redirect": 0,
        "broken": 0,
        "blocked": 0,
        "unreachable": 0,
    }
    broken_links: dict[str, list[dict]] = {
        "redirect": [],
        "broken": [],
        "blocked": [],
        "unreachable": [],
    }
    for result in all_results:
        counts[result.status] = counts.get(result.status, 0) + 1
        if result.status != "ok":
            broken_links[result.status].append(asdict(result))

    summary = {
        "total_checked": len(all_results),
        "counts": counts,
        "broken_links": broken_links,
        # "results": [asdict(r) for r in all_results],
    }

    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print("=" * 60)
    print(f"Total URLs checked : {len(all_results)}")
    print(f"OK                 : {counts['ok']}")
    print(f"Redirect / moved   : {counts['redirect']}")
    print(f"Broken (404 etc.)  : {counts['broken']}")
    print(f"Blocked (403 etc.) : {counts['blocked']}")
    print(f"Unreachable        : {counts['unreachable']}")
    print(f"\nReport saved to    : {report_path}")


if __name__ == "__main__":
    main()