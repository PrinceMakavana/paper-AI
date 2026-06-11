# paperAI

Document chat app for uploading PDFs, indexing them with a local PageIndex-style Python service, and asking questions through an Express API using Gemini or Ollama.

## What Is In This Repo

| Part | Path | Role |
|------|------|------|
| Frontend | `frontend/` | Next.js UI for PDF upload, document history, and chat |
| App API | `backend/` | Express API used directly by the browser for upload and question answering |
| Indexing service | `pageindex-backend/` | FastAPI service that stores PDFs, runs background PageIndex indexing, and returns page text/status |

The current main flow is:

1. Browser uploads a PDF to Express: `POST /paperai/upload`.
2. Express validates the PDF, then forwards it to FastAPI: `POST /upload`.
3. FastAPI stores the file and indexes it in the background.
4. Browser asks Express: `POST /paperai/question-vectorless-rag`.
5. Express fetches indexed structure/page text from FastAPI, builds context, and calls Gemini or Ollama.

The old Next.js local API routes under `frontend/app/api/local-pageindex/` have been removed. The UI now calls the Express backend directly.

## Prerequisites

- Node.js 20+ recommended. The backend requires Node.js 18+.
- Python 3.10+ for `pageindex-backend/`.
- Ollama installed and running if you use the `ollama` chat model.
- Google AI API key if you use the `gemini` chat model.

## Install Dependencies

Install each app separately:

```bash
cd frontend
npm install
```

```bash
cd backend
npm install
```

```bash
cd pageindex-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On Windows, activate the Python venv with:

```bash
.venv\Scripts\activate
```

## Environment Variables

Create env files for the services you run. Do not commit real secrets.

### Frontend

Create `frontend/.env` or `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
# Production only — omit locally so dev traffic is not sent to GA4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-WPXWX6KJ1V
```

Because these values are exposed to the browser, only put the public Express API URL and GA measurement ID here.

### Express Backend

Create `backend/.env` from `backend/.env.example`:

```env
PORT=5000
FRONTEND_URL=http://localhost:3000
PAGEINDEX_BACKEND_API_URL=http://127.0.0.1:8000

GEMINI_API_KEY=
GEMINI_MODEL_NAME=gemini-2.5-flash-lite
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL_NAME=llama3
```

Key variables:

| Variable | Used for |
|----------|----------|
| `PORT` | Express API port |
| `FRONTEND_URL` | CORS origin allowed by Express |
| `PAGEINDEX_BACKEND_API_URL` | FastAPI indexing service URL |
| `GEMINI_API_KEY` | Gemini chat model |
| `GEMINI_MODEL_NAME` | Gemini model used by Express |
| `OLLAMA_API_URL` | Ollama server URL |
| `OLLAMA_MODEL_NAME` | Ollama chat model used by Express |
| `PAGEINDEX_API_URL` | Hosted PageIndex chat/auth/upload base URL |
| `PAGEINDEX_API_DASHBOARD_URL` | Hosted PageIndex dashboard URL (password reset, API keys) |
| `PAGEINDEX_SECRETS_KEY` | Base64 32-byte key for encrypting stored PageIndex credentials |
| `PAGEINDEX_JOB_TEMP_ROOT` | Temp directory for staged PDFs during hosted upload jobs |
| `MONGODB_URI` | MongoDB connection string for users, documents, and chat |
| `JWT_SECRET` | Secret used to sign login and verification tokens |
| `SMTP_HOST` | SMTP server host for verification and password-reset emails |
| `SMTP_PORT` | SMTP port (default `587`) |
| `SMTP_SECURE` | Set to `true` for TLS on port 465 |
| `SMTP_USER` | SMTP username (optional for open relays) |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address, e.g. `PaperAI <noreply@yourdomain.com>` |
| `EMAIL_VERIFICATION_EXPIRES_IN` | Verification link lifetime (default `24h`) |

If SMTP is not configured, verification and reset links are logged to the backend console instead of being emailed. Set `FRONTEND_URL` to the public Next.js URL so links point to `/verify-email` and `/reset-password`.

### Python PageIndex Service

`pageindex-backend/.env` is loaded by the Python indexing code. Add model/provider keys needed by `pageindex-backend/pageindex/config.yaml`, for example Gemini or Ollama settings.

The Python service also supports:

| Variable | Used for |
|----------|----------|
| `PAGEINDEX_MAX_CONCURRENT` | Max parallel indexing jobs. Defaults to `1` |

Uploaded PDFs and generated index JSON files are written under `pageindex-backend/data/`.

## Run The App

Start the Python indexing service:

```bash
cd pageindex-backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Start the Express API:

```bash
cd backend
npm run dev
```

Start the Next.js frontend:

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default local URLs:

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:3000` |
| Express backend | `http://localhost:5000` |
| Python PageIndex service | `http://127.0.0.1:8000` |

## API Endpoints

### Express Backend

These are the endpoints used by the frontend:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/catalog/subjects` | Lists GTU subject catalog entries from `data/*.json` |
| `GET` | `/catalog/subjects/:subjectCode` | Returns subject metadata and indexed books |
| `GET` | `/catalog/subjects/:subjectCode/books/:bookId/pdf-url` | Signed URL for a catalog book PDF (when uploaded to S3) |
| `POST` | `/paperai/upload` | Accepts multipart `file` and optional `chatModel`; validates PDF and forwards it to FastAPI |
| `POST` | `/paperai/question-vectorless-rag` | Accepts `question`, `documentId`, and `chatModel`; builds context and returns an answer |
| `POST` | `/paperai/subject-question-rag` | Accepts `question`, `subjectCode`, and `chatModel`; searches all ready books in the subject |
| `GET` | `/paperai/chat-messages/subject/:subjectCode` | Chat history for a subject session |
| `DELETE` | `/paperai/chat-messages/subject/:subjectCode` | Clears subject chat history |

Legacy `/pageindex/*` paths remain as backward-compatible aliases.

Set `CATALOG_DATA_DIR` in `backend/.env` to the folder containing subject JSON files (default: repo `data/`).

### Python PageIndex Service

Express calls these internally:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/upload` | Stores PDF and starts background indexing |
| `GET` | `/upload/{doc_id}/status` | Returns queued/running/complete/error status and indexed structure |
| `GET` | `/upload/{doc_id}/page-text?pages=1,2` | Returns extracted text for selected PDF pages |
| `GET` | `/catalog/page-index?s3_uri=` | Loads pre-indexed `page_index.json` from S3 by `s3://` URI |
| `GET` | `/catalog/page-text?storage_path=&pages=` | Returns extracted text from a catalog PDF in S3 |

## Ollama Notes

Start Ollama locally:

```bash
ollama serve
```

Pull the chat model used by Express:

```bash
ollama pull llama3
```

For indexing, also make sure `pageindex-backend/pageindex/config.yaml` uses models you have available. Example:

```yaml
model: "ollama/gemma3:12b"
retrieve_model: "ollama/gemma3:12b"
```

Then pull those model tags:

```bash
ollama pull gemma3:12b
```

## Scripts

Frontend:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Express backend:

```bash
npm run dev
npm run start
npm test
```

## Project Layout

- `frontend/app/` - Next.js App Router pages and remaining API routes for alternate/legacy flows.
- `frontend/components/` - Chat UI, upload UI, document history, and shared UI primitives.
- `frontend/utils/` - Frontend helpers and legacy PageIndex utilities.
- `backend/app.js` - Express app setup, CORS, route mounting.
- `backend/routes/pageIndexRoutes.js` - Express paperAI routes (`/paperai/*`) used by the frontend.
- `backend/controllers/pageIndexController.js` - Upload validation, FastAPI calls, context building, and model invocation.
- `backend/utils/` - Backend model selection and vectorless context helpers.
- `pageindex-backend/main.py` - FastAPI upload/status/page-text API.
- `pageindex-backend/pageindex/` - Local indexing implementation and config.

## Deployment Notes

Deploy the three services separately:

- Frontend: any Next.js host.
- Express backend: Node-capable host or container.
- Python PageIndex service: Python-capable host or container with access to your model provider/Ollama.

Set `NEXT_PUBLIC_API_URL` in the frontend deployment to the public Express URL. Set `PAGEINDEX_BACKEND_API_URL` in Express to the public or private URL of the Python indexing service.



[
    "toc_detector",
    "toc_detector",
    "page_index_detection",
    "toc_detector",
    "toc_detector",
    "toc_structure_generation",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_appearance_check",
    "title_start_check",
    "title_start_check",
    "title_start_check",
    "title_start_check"
]