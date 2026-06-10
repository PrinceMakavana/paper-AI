# Development Roadmap

This roadmap turns the current AI Document Assistant prototype into a customer-ready SaaS product. The phases are ordered intentionally: billing should come after authentication, persistent storage, and usage tracking.

## Phase 1: Product Foundation

Goal: make the current app stable, clean, and reliable for a single user.

### Tasks

- Fix app naming, spelling, labels, and empty states.
- Add PDF validation for file type, max file size, and page limit.
- Add clear UI states for upload, indexing, ready, answering, and failure.
- Improve document history with delete, rename, and selected-document states.
- Store each document with a unique ID.
- Tie chat history to the selected document.
- Add basic backend logging for upload, indexing, and chat requests.
- Add clear error responses from the backend.

### Deliverable

A polished single-user app that reliably uploads PDFs, indexes them, and answers questions against the selected document.

## Phase 2: Database And Storage

Goal: remove dependency on local JSON files and local-only document state.

### Recommended Stack

- PostgreSQL or Supabase Postgres for structured data.
- pgvector for document embeddings when RAG is added.
- Supabase Storage, S3, Google Cloud Storage, or Cloudflare R2 for uploaded PDFs.

### Initial Tables

```text
users
documents
document_pages
document_chunks
chat_sessions
chat_messages
usage_events
```

### Tasks

- Move document metadata from local JSON files into the database.
- Store uploaded PDFs in object storage.
- Store extracted page text and page index data in the database.
- Add migration scripts.
- Keep local file storage only as a development fallback.
- Add database IDs to all document and chat APIs.

### Deliverable

A production-style persistence layer where documents, page indexes, and chats survive deployments and are not tied to local files.

## Phase 3: Authentication And User Accounts

Goal: make the app multi-user and private per customer.

### Tasks

- Add signup and login.
- Add authenticated API requests.
- Associate every document, chat session, chat message, and usage event with a user.
- Prevent users from accessing documents owned by other users.
- Add a simple user dashboard.
- Add account settings.
- Add logout and session refresh handling.

### Recommended Option

Use Supabase Auth if Supabase is selected for the database. It reduces custom auth work and pairs well with Supabase Postgres and Storage.

### Deliverable

Each customer has a private account with isolated documents, chat history, and usage records.

## Phase 4: RAG Quality And AI Cost Control

Goal: improve answer quality while keeping model usage measurable and affordable.

### Tasks

- Split extracted document text into chunks.
- Generate embeddings for each chunk.
- Store embeddings in pgvector.
- Retrieve only relevant chunks for each user question.
- Include page citations in answers.
- Add behavior for questions that are not answered by the document.
- Track input tokens, output tokens, model name, and request cost estimate.
- Use a low-cost model as the default.
- Reserve stronger models for paid plans or complex questions.
- Add evaluation examples for common document-question workflows.

### Deliverable

Accurate document Q&A with citations, better context retrieval, and measurable AI usage cost.

## Phase 5: Billing And Customer Launch

Goal: convert the product into a paid SaaS with plan limits and production operations.

### Example Plans

```text
Free: 3 PDFs/month, 50 questions/month, small file limit
Starter: $9/month, 100 PDFs/month, 2,000 questions/month
Pro: $29/month, 1,000 PDFs/month, 10,000 questions/month
Business: custom limits, team users, support, optional private deployment
```

### Tasks

- Create a pricing page.
- Add Stripe or Paddle checkout.
- Add a subscriptions table.
- Add billing webhook handling.
- Enforce plan limits before upload and chat requests.
- Add upgrade, downgrade, and cancel flows.
- Add an admin view for users, documents, subscriptions, and usage.
- Deploy frontend, backend, database, and storage.
- Add monitoring, error tracking, and usage alerts.
- Add backups and basic disaster recovery.

### Deliverable

A customer-ready SaaS with paid plans, usage limits, billing lifecycle handling, and production monitoring.

## Recommended Build Order

```text
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5
```

Do not add billing first. Billing only works correctly after the app can identify users, store customer data safely, and measure usage accurately.
