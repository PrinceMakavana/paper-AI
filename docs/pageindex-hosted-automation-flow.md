# Hosted Upload Automation Flow

> Status: **Implemented** as a resumable background job.
> Entry point: `POST /paperai/hosted-jobs` (JWT required) with `email` + optional PDF `file`.
> Legacy alias: `POST /pageindex/hosted-jobs`.
>
> Note: This flow integrates with the external **PageIndex** hosted service (`PAGEINDEX_API_URL`). The paperAI product API uses `/paperai/*` paths.

## Hosts

| Host | Env var | Used for |
|------|---------|----------|
| PageIndex Chat / Auth / Upload | `PAGEINDEX_API_URL` | CSRF, email sign-in, OTP verify, file upload |
| PageIndex Dashboard | `PAGEINDEX_API_DASHBOARD_URL` | Forgot/reset password, dashboard login, API key |

---

## Step 1 — Create account on PageIndex

**Host:** `PAGEINDEX_API_URL`

1. Take user email from request; generate YOPmail address  
   - Format: `{local-part}@yopmail.com` (local-part = part before `@` in input email)
2. `GET /api/auth/csrf` → obtain CSRF token + session cookies
3. `POST /api/auth/signin/email` with YOPmail address → trigger verification email
4. Wait **5 seconds** for email delivery
5. Poll YOPmail inbox via `easy-yopmail` (up to **5 attempts**, 5s between retries)  
   - Filter: from `PageIndex`, subject contains verification code
6. Read email body → extract 6-digit OTP
7. `POST /api/auth/callback/otp` with OTP → authenticated session cookies

**Store in database:**
- `pageindex_email` (YOPmail address)
- Link to Paper-AI `user_id` (when auth is added to this route)
- `index_status` or account status: `verified`

**Do not store:** CSRF token, OTP, raw email content, session cookies (short-lived; keep in request memory only).

**On failure:** Abort entire flow.

---

## Step 2 — Upload file (conditional)

**Condition:** PDF `file` is provided in the request.

**Host:** `PAGEINDEX_API_URL` (uses session cookies from Step 1)

1. `POST /api/orpc/file/getSignedUrl` → presigned upload URL
2. `PUT` file bytes to presigned URL
3. `POST /api/orpc/file/upload` → register file with PageIndex (`mode: mcp`, `if_ocr: true`)
4. Read `doc_id`, `page_count`, `estimated_time` from register response

**Store in database:**
- `document_id` (`doc_id` from PageIndex)
- `document_name`, `page_count`, `mime_type`, `file_size` (if available)
- `index_status`: `processing` (or `uploaded` until tree is ready)
- `source`: `hosted` (to distinguish from local FastAPI indexer flow)

**On failure:** Log error; continue to Step 3. Skip Step 4.3 later.

---

## Step 3 — Set password via dashboard reset

**Host:** `PAGEINDEX_API_DASHBOARD_URL`

1. `POST /api/rpc/user/sendResetPassword` with YOPmail email
2. Wait **5 seconds** for email delivery
3. Poll YOPmail inbox (up to **5 attempts**, 5s between retries)  
   - Filter: from `PageIndex`, subject contains password reset
4. Read email → extract reset-password link → extract `token` from URL
5. Generate a random password
6. `POST /api/rpc/user/resetPassword` with `token`, `password`, `confirmPassword`

**Store in database:**
- `pageindex_password` (**encrypted at rest**)

**On failure:** Abort entire flow (account exists but is not usable for dashboard login).

---

## Step 4 — Dashboard login, API key, document tree

### Step 4.1 — Dashboard login (always)

**Condition:** Step 3 succeeded.

**Host:** `PAGEINDEX_API_DASHBOARD_URL`

1. `GET /api/auth/csrf` (dashboard) → CSRF token + cookies
2. `POST /api/auth/callback/password` with YOPmail email + password from Step 3
3. Capture dashboard session cookies

**Store in database:**
- Account status: `dashboard_authenticated`
- **Do not store:** CSRF token, dashboard session cookies (expire quickly)

**On failure:** Abort; API key and tree cannot proceed.

---

### Step 4.2 — Create API key (always)

**Condition:** Step 4.1 succeeded.

**Host:** `PAGEINDEX_API_DASHBOARD_URL` (dashboard session cookies)

1. `POST /api/rpc/apiKey/create` with a generated key name
2. Read `apiKey` from response

**Store in database:**
- `pageindex_api_key` (**encrypted at rest**)
- `api_key_name` (optional, for reference)

**On failure:** Abort or mark account as `api_key_failed` (TBD).

---

### Step 4.3 — Fetch document tree (conditional)

**Condition:** Step 2 succeeded **and** `doc_id` is available **and** API key from 4.2 exists.

**Mechanism:** `@pageindex/sdk` — `PageIndexClient.api.getTree(doc_id)` with API key (not a dashboard RPC).

1. Poll `getTree(doc_id)` every **3 seconds**
2. Stop when `status === 'completed'` (or timeout based on `estimated_time` from Step 2)
3. Capture `result` (tree), `retrieval_ready`

**Store in database:**
- `index_status`: `completed` or `failed`
- Tree: `page_index.json` in S3 at `pageindex/{userId}/{documentId}/page_index.json` (`pageindex_s3_uri` + `pageindex_storage_path` on document)
- `retrieval_ready`, `error_message` (if failed)

**On failure:** Do not fail the whole flow; account + API key remain valid. Mark document `index_status: failed`.

---

## Execution order

```
Step 1
  → Step 2 (if file)
  → Step 3
  → Step 4.1 (always)
  → Step 4.2 (always)
  → Step 4.3 (if file + doc_id)
```

---

## Error-handling policy (draft)

| Step | On failure |
|------|------------|
| 1 | Abort — no account |
| 2 | Continue — no `doc_id`; skip 4.3 |
| 3 | Abort — no usable password |
| 4.1 | Abort — no dashboard session |
| 4.2 | Abort or partial success (TBD) |
| 4.3 | Continue — return account + key; document stays `processing`/`failed` |

---

## Job system

Each registration attempt creates one document in `pageindex_hosted_jobs` (linked to `user_id`).

| Property | Value |
|----------|-------|
| Max retries | 5 per step |
| Resume | Restarts from first incomplete step |
| Non-fatal steps | Upload (step 2), tree fetch (step 4.3) |
| Staging | PDF copied to S3 immediately; transient copy under `PAGEINDEX_JOB_TEMP_ROOT` until PageIndex upload step completes |

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/paperai/hosted-jobs` | Create job (202, returns `job_id`) |
| `GET` | `/paperai/hosted-jobs/:jobId` | Poll job status |
| `GET` | `/paperai/hosted-jobs` | List user's jobs |
| `POST` | `/paperai/hosted-jobs/:jobId/retry` | Manual retry for failed jobs |

Legacy `/pageindex/*` paths remain as aliases.

### Implementation files

- Model: `backend/models/pageIndexHostedJobModel.js`
- Runner: `backend/services/pageindexHosted/jobRunner.js`
- Steps: `backend/services/pageindexHosted/steps.js`
- Routes: `backend/routes/pageIndexHostedJobRoutes.js`

Legacy `POST /paperai/register` (alias: `/pageindex/register`) returns `410 Gone`.

### Main app upload integration

`POST /paperai/upload` (existing chat UI route) now:

1. Generates a random dummy source email (`paperai-{hex}@upload.local` → YOPmail)
2. Creates a hosted job + placeholder `pageindex_documents` row (`document_id` = job id)
3. Returns `documentId` immediately for frontend status polling
4. On upload accept, stores `source.pdf` in S3 at `pageindex/{userId}/{documentId}/source.pdf` (`pdf_s3_uri` on document)
5. On tree completion (step 4.3), uploads `page_index.json` to the same S3 prefix and sets `pageindex_s3_uri` / `pageindex_storage_path` on the document
6. Chat (`question-vectorless-rag`) loads hosted trees from S3 instead of the Python indexer

### Logging

Hosted job events are written to:

- **Console** — prefix `[PageIndexHostedJob] | LEVEL | job={id} | step={step} | message`
- **File** — `backend/logs/hosted-jobs/job_{jobId}_{timestamp}.json` (full event history per job)

Log levels: `INFO`, `SUCCESS`, `WARN`, `ERROR`. Each step logs start, sub-actions, success, failures, and retry scheduling.
