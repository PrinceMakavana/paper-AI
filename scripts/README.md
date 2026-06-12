# Scripts

Python utilities for auditing and fixing URLs in subject JSON files under `data/`. Run all commands from the **project root** (`paper-AI/`).

## Setup

```bash
# check_links.py and replace_bitly_links.py — stdlib only
python3 --version   # 3.10+

# fix_broken_link.py — Google Drive upload
pip install -r scripts/requirements-drive.txt
```

For `fix_broken_link.py`, place a Google Cloud OAuth **Desktop** client JSON at `scripts/drive_credentials.json` (enable the Google Drive API first). On first run, a browser opens for consent; the token is saved to `scripts/drive_token.json`.

Do not commit `drive_credentials.json`, `drive_token.json`, or other secrets.

---

## `check_links.py`

HTTP-audit every URL in `data/*.json`. Writes a summary to `link_audit_report.json` (project root).

```bash
# Full scan (all statuses printed)
python3 scripts/check_links.py

# Only broken / blocked / redirect / unreachable
python3 scripts/check_links.py --broken-only

# Skip thumbnail img URLs (recommended)
python3 scripts/check_links.py --skip-images --broken-only

# Custom paths
python3 scripts/check_links.py --data-dir data --report my_report.json --timeout 30
```

| Flag | Default | Description |
|------|---------|-------------|
| `--data-dir` | `data` | Folder with subject JSON files |
| `--timeout` | `20` | Request timeout (seconds) |
| `--skip-images` | off | Skip `img` / thumbnail URLs |
| `--broken-only` | off | Print only non-ok links |
| `--report` | `link_audit_report.json` | Output JSON report path |

**Status values:** `ok`, `redirect`, `broken`, `blocked`, `unreachable`

---

## `replace_bitly_links.py`

Replace `bit.ly` short links in subject JSON using mappings from `bitly_data.json`.

```bash
# Preview changes (no files written)
python3 scripts/replace_bitly_links.py --dry-run

# Apply replacements
python3 scripts/replace_bitly_links.py

# Custom paths
python3 scripts/replace_bitly_links.py --bitly bitly_data.json --data-dir data
```

| Flag | Default | Description |
|------|---------|-------------|
| `--bitly` | `bitly_data.json` | Bitly export with `short_link` / `original_link` |
| `--data-dir` | `data` | Subject JSON folder |
| `--dry-run` | off | Report only; do not write files |

---

## `fix_broken_link.py`

Upload a local PDF (or other file) to Google Drive, make it public, and update the broken URL in a subject JSON file.

### Single fix

```bash
# Dry-run: validate paths and field without uploading
python3 scripts/fix_broken_link.py \
  --local-file /path/to/paper.pdf \
  --subject-file 2150704.json \
  --field 'Books[1].download_link' \
  --dry-run

# Upload and update JSON
python3 scripts/fix_broken_link.py \
  --local-file /path/to/paper.pdf \
  --subject-file 2150704.json \
  --field 'Books[1].download_link' \
  --old-url 'https://broken.example.com/old.pdf'

# From a broken-link entry (e.g. from link_audit_report.json)
python3 scripts/fix_broken_link.py \
  --local-file /path/to/paper.pdf \
  --entry-json '{"file":"2150704.json","field":"Books[1].download_link","url":"https://..."}'

# Or from an entry file
python3 scripts/fix_broken_link.py \
  --local-file /path/to/paper.pdf \
  --entry-file broken_entry.json
```

### Batch fix

Batch file: JSON array of `{"broken": {...}, "local_file": "..."}` objects.

```bash
python3 scripts/fix_broken_link.py --batch scripts/batch_fixes.json --dry-run
python3 scripts/fix_broken_link.py --batch scripts/batch_fixes.json
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--local-file` | — | Local file path (`file:///...` supported). Required unless `--batch` |
| `--entry-json` | — | Inline broken-link object |
| `--entry-file` | — | JSON file with broken-link object or `{"broken": {...}}` |
| `--subject-file` | — | Subject filename, e.g. `2150704.json` |
| `--field` | — | Dot path, e.g. `Books[1].download_link` |
| `--old-url` | — | Expected current URL (safety check) |
| `--batch` | — | JSON array for multiple fixes |
| `--data-dir` | `data` | Subject JSON folder |
| `--credentials` | `scripts/drive_credentials.json` | OAuth client secrets |
| `--token` | `scripts/drive_token.json` | Saved OAuth token |
| `--folder-id` | — | Optional Drive folder ID for uploads |
| `--view-url` | off | Store view link instead of direct download URL |
| `--dry-run` | off | Validate only; no upload or JSON write |
| `--force` | off | Replace even if current URL differs from `--old-url` |
| `--log` | `scripts/link_fix_log.json` | Append fix history here |

---

## Typical workflow

```bash
# 1. Find broken links
python3 scripts/check_links.py --skip-images --broken-only

# 2. Expand any remaining bit.ly links
python3 scripts/replace_bitly_links.py --dry-run
python3 scripts/replace_bitly_links.py

# 3. Re-audit, then fix individual links via Drive upload
python3 scripts/check_links.py --skip-images --broken-only
python3 scripts/fix_broken_link.py \
  --local-file ./downloads/paper.pdf \
  --subject-file 2150704.json \
  --field 'syllabus' \
  --old-url 'https://...'
```

---

## Files in this folder

| File | Purpose |
|------|---------|
| `check_links.py` | URL audit |
| `replace_bitly_links.py` | Bitly → original URL replacement |
| `fix_broken_link.py` | Drive upload + JSON patch |
| `requirements-drive.txt` | pip deps for Drive script |
| `link_fix_log.json` | Auto-appended fix history (generated) |
| `drive_credentials.json` | OAuth client secrets (you provide; gitignored) |
| `drive_token.json` | Saved OAuth token (generated; gitignored) |
