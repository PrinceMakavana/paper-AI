#!/usr/bin/env python3
"""Replace bit.ly short links with original URLs in subject JSON files."""

import argparse
import json
import re
from pathlib import Path

BITLY_PATTERN = re.compile(r"https?://(?:www\.)?bit\.ly/\S+", re.IGNORECASE)


def load_bitly_map(bitly_path: Path) -> dict[str, str]:
    with bitly_path.open(encoding="utf-8") as f:
        entries = json.load(f)
    mapping = {}
    for item in entries:
        short = item["short_link"].strip()
        original = item["original_link"].strip()
        mapping[short] = original
        # Also map without trailing slash if present
        mapping[short.rstrip("/")] = original
    return mapping


def replace_in_value(value, mapping: dict, stats: dict):
    if isinstance(value, dict):
        return {k: replace_in_value(v, mapping, stats) for k, v in value.items()}
    if isinstance(value, list):
        return [replace_in_value(v, mapping, stats) for v in value]
    if isinstance(value, str):
        match = BITLY_PATTERN.search(value.strip())
        if not match:
            return value
        short = match.group(0).rstrip("/")
        if short in mapping:
            stats["replaced"] += 1
            return mapping[short]
        stats["missing"].add(short)
        return value
    return value


def process_file(path: Path, mapping: dict, dry_run: bool) -> dict:
    stats = {"replaced": 0, "missing": set()}
    with path.open(encoding="utf-8") as f:
        data = json.load(f)

    updated = replace_in_value(data, mapping, stats)

    if stats["replaced"] > 0 and not dry_run:
        with path.open("w", encoding="utf-8") as f:
            json.dump(updated, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bitly", default="bitly_data.json")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    mapping = load_bitly_map(root / args.bitly)
    data_dir = root / args.data_dir

    total_replaced = 0
    all_missing = set()
    files_changed = 0

    for path in sorted(data_dir.glob("*.json")):
        stats = process_file(path, mapping, args.dry_run)
        if stats["replaced"]:
            files_changed += 1
            total_replaced += stats["replaced"]
            print(f"{path.name}: {stats['replaced']} link(s) replaced")
        all_missing.update(stats["missing"])

    print(f"\nDone. {files_changed} file(s), {total_replaced} link(s) replaced.")
    if all_missing:
        print(f"\nWarning: {len(all_missing)} bit.ly link(s) not in bitly_data.json:")
        for link in sorted(all_missing):
            print(f"  - {link}")
    if args.dry_run:
        print("\n(dry run — no files written)")


if __name__ == "__main__":
    main()