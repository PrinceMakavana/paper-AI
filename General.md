# PageIndex AI — Product Overview

**PageIndex AI** is a proof-of-concept application that turns PDFs into something you can actually talk to. You upload a document, the system builds a structured index of its content, and you ask questions in natural language. Answers are meant to stay grounded in what is in the file—not generic model guesses—so the experience feels closer to “chat with this contract / report / handbook” than to a general-purpose chatbot.

## Who It Is For

Anyone who needs to **extract meaning from long PDFs** without reading every page linearly: analysts reviewing reports, teams onboarding with internal docs, or builders experimenting with document-QA workflows. The project is explicitly a **POC**: it demonstrates the architecture and flow rather than shipping as a finished commercial product.

## What You Can Do

- **Upload PDFs** through a web UI and track them in a **document history** so you can return to past files.
- **Summarize and query** indexed documents: ask focused questions and get responses informed by indexed structure and page text.
- **Work in a signed-in workspace** for the main PageIndex flow (registration/login), so uploads and chats are tied to your account when MongoDB and auth are configured.
- **Choose how “brains” run**: the stack supports **Google Gemini** and **local Ollama** models for chat (and indexing can be configured similarly in the Python service).

There is also a separate **public RAG-style** API path (`/ragchat/*`) for upload and chat without JWT, useful for experiments or integrations that do not use the protected chat workspace.

## How It Fits Together (High Level)

Three pieces cooperate:

1. **Frontend (Next.js)** — Landing page, login/register, chat, upload, and document sidebar. It talks to the Node API configured via `NEXT_PUBLIC_API_URL`.
2. **App API (Express)** — Validates uploads, forwards PDFs to the indexer, loads index status and page text, assembles context for “vectorless” RAG-style Q&A, and calls Gemini or Ollama. User accounts and protected routes use MongoDB when configured.
3. **Indexing service (Python / FastAPI)** — Stores PDFs, runs **PageIndex-style** indexing in the background (structure and retrieval-oriented setup in `pageindex-backend/pageindex/`), and exposes status and page text to the Express layer.

The README in this repository describes **ports, environment variables, and exact endpoints** if you want to run or extend the stack.

## Design Intent

- **Grounded answers**: Indexing and context building are oriented toward answering from the document, not free-form invention.
- **Clear separation of concerns**: UI, orchestration (Express), and heavy indexing (Python) stay in separate services so you can scale or swap pieces independently.
- **Flexible models**: Swap Gemini vs Ollama depending on whether you prefer cloud APIs or on-prem inference.

## Summary

PageIndex AI is a **document-centric AI assistant POC**: upload PDFs, index them with a dedicated Python service, and chat over them through a modern web app and Express API, with optional cloud or local models. Use the root **README.md** for setup, configuration, and API tables; use this file when you need a **plain-language picture of what the product is trying to be**.
