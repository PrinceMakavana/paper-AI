#!/usr/bin/env python3
"""Replace bit.ly short links with original URLs in subject JSON files."""

from __future__ import annotations

import argparse
import json
import re
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

BITLY_PATTERN = re.compile(r"https?://(?:www\.)?bit\.ly/\S+", re.IGNORECASE)

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
}


def load_bitly_map(bitly_path: Path) -> dict[str, str]:
    with bitly_path.open(encoding="utf-8") as f:
        entries = json.load(f)
    mapping = {}
    for item in entries:
        short = item["short_link"].strip()
        original = item["original_link"].strip()
        mapping[short] = original
        mapping[short.rstrip("/")] = original
    return mapping


def is_bitly_host(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return host in ("bit.ly", "www.bit.ly")


def resolve_bitly_url(short_url: str, timeout: int) -> str | None:
    """Follow redirects and return the final non-bit.ly URL."""
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(short_url, method=method, headers=BROWSER_HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                final = response.geturl().strip()
        except urllib.error.HTTPError as exc:
            if method == "HEAD" and exc.code in (403, 405, 501):
                continue
            final = exc.geturl().strip() if exc.geturl() else ""
            if not final or is_bitly_host(final):
                return None
        except (urllib.error.URLError, ssl.SSLError, TimeoutError):
            if method == "GET":
                return None
            continue
        else:
            if final and not is_bitly_host(final):
                return final
            if method == "GET":
                return None
    return None


def lookup_original(
    short: str,
    mapping: dict[str, str],
    resolve_cache: dict[str, str | None],
    timeout: int,
    stats: dict,
    resolve_missing: bool,
) -> str | None:
    if short in mapping:
        return mapping[short]

    normalized = short.rstrip("/")
    if normalized in mapping:
        return mapping[normalized]

    if not resolve_missing:
        stats["missing"].add(short)
        return None

    if short not in resolve_cache:
        print(f"  resolving {short} ...")
        resolve_cache[short] = resolve_bitly_url(short, timeout)
        if resolve_cache[short]:
            print(f"    -> {resolve_cache[short]}")

    original = resolve_cache[short]
    if original:
        stats["resolved"].add(short)
        return original

    stats["failed"].add(short)
    return None


def replace_in_value(
    value,
    mapping: dict,
    resolve_cache: dict[str, str | None],
    timeout: int,
    stats: dict,
    resolve_missing: bool,
):
    if isinstance(value, dict):
        return {
            k: replace_in_value(v, mapping, resolve_cache, timeout, stats, resolve_missing)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [
            replace_in_value(v, mapping, resolve_cache, timeout, stats, resolve_missing)
            for v in value
        ]
    if isinstance(value, str):
        match = BITLY_PATTERN.search(value.strip())
        if not match:
            return value
        short = match.group(0).rstrip("/")
        original = lookup_original(
            short, mapping, resolve_cache, timeout, stats, resolve_missing
        )
        if original:
            stats["replaced"] += 1
            return original
        return value
    return value


def process_file(
    path: Path,
    mapping: dict,
    resolve_cache: dict[str, str | None],
    timeout: int,
    dry_run: bool,
    resolve_missing: bool,
) -> dict:
    stats = {"replaced": 0, "missing": set(), "resolved": set(), "failed": set()}
    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    updated = replace_in_value(
        data, mapping, resolve_cache, timeout, stats, resolve_missing
    )

    if stats["replaced"] > 0 and not dry_run:
        with path.open("w", encoding="utf-8") as f:
            json.dump(updated, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bitly", default="bitly_data.json")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--timeout", type=int, default=20, help="HTTP timeout for resolving unknown bit.ly links")
    parser.add_argument(
        "--no-resolve",
        action="store_true",
        help="Do not resolve unknown bit.ly links over HTTP (only use bitly_data.json)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    mapping = load_bitly_map(root / args.bitly)
    data_dir = root / args.data_dir
    resolve_missing = not args.no_resolve
    resolve_cache: dict[str, str | None] = {}

    total_replaced = 0
    all_missing = set()
    all_resolved = set()
    all_failed = set()
    files_changed = 0

    for path in sorted(data_dir.glob("*.json")):
        stats = process_file(
            path,
            mapping,
            resolve_cache,
            args.timeout,
            args.dry_run,
            resolve_missing,
        )
        if stats["replaced"]:
            files_changed += 1
            total_replaced += stats["replaced"]
            print(f"{path.name}: {stats['replaced']} link(s) replaced")
        all_missing.update(stats["missing"])
        all_resolved.update(stats["resolved"])
        all_failed.update(stats["failed"])

    print(f"\nDone. {files_changed} file(s), {total_replaced} link(s) replaced.")
    if all_resolved:
        print(f"\nResolved {len(all_resolved)} unknown bit.ly link(s) via HTTP:")
        for link in sorted(all_resolved):
            print(f"  - {link} -> {resolve_cache[link]}")
    if all_missing:
        print(f"\nWarning: {len(all_missing)} bit.ly link(s) not in bitly_data.json (--no-resolve):")
        for link in sorted(all_missing):
            print(f"  - {link}")
    if all_failed:
        print(f"\nWarning: {len(all_failed)} bit.ly link(s) could not be resolved:")
        for link in sorted(all_failed):
            print(f"  - {link}")
    if args.dry_run:
        print("\n(dry run — no files written)")


if __name__ == "__main__":
    main()
