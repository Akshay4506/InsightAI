# InsightAI - AI-Powered Data Analyst

Ask a question in plain English; get a validated SQL query, a chart, a table, written insights and follow-up questions. This is an auditable agentic pipeline (Text-to-SQL + RAG), not a chatbot. Every step is shown in a live "Agent Brain" trace with latencies.

Built as a 7th-semester Generative AI Skill Enhancement Lab project.

## Architecture

```
 React + Tailwind + Recharts + Framer Motion            FastAPI
┌──────────┬──────────────────────┬────────────┐   ┌──────────────────────────────────────────┐
│ Sidebar  │  Chat + Result card  │ Agent Brain│──▶│ POST /api/ask                            │
└──────────┴──────────────────────┴────────────┘   │  1 Schema retrieval  ChromaDB (RAG)      │
                                                    │  2 Text-to-SQL       Gemini -> Groq      │
                                                    │  3 Validator         sqlparse allowlist  │
                                                    │  4 Executor          SQLite read-only    │
                                                    │  5 Analyzer          pandas + chart pick │
                                                    │  6 Insights          LLM JSON            │
                                                    └──────────────────────────────────────────┘
```

Mermaid diagrams: [demo/architecture.md](demo/architecture.md).

## Setup

Requirements: Python 3.11+, Node 18+, and a running MongoDB (default `mongodb://localhost:27017`). The app creates the database `insight-ai` itself.

```bash
# 1. backend (terminal 1)
cd backend
cp .env.example .env            # then set GEMINI_API_KEY and JWT_SECRET (and MONGODB_URI if not local)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.db.seed            # optional: also happens automatically on first start
uvicorn app.main:app --reload    # http://localhost:8000

# 2. frontend (terminal 2)
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

To deploy (MongoDB Atlas + Render + Vercel) see [DEPLOY.md](DEPLOY.md).

Open http://localhost:5173, create an account, then either use the built-in sample data or upload your own CSV/Excel file.

Useful checks:

```bash
cd backend
python tests_security.py         # 30 validator cases (blocked + allowed)
python run_questions.py          # runs 9 analytics questions + 5 attacks through the pipeline
```

## Accounts, uploads and history

- **Pages:** Home `/`, Login `/login` (email or phone + password), Sign up `/signup` (name, email, phone, password min 8, confirm), Profile `/profile` (name/email/phone read-only, change password), Workspace `/analyze` (login required).
- **Navbar:** logo + name (always links home) on the left; theme toggle then Login button (logged out) or profile avatar with a dropdown arrow (My Profile / Logout) on the right. Login and sign up show only the logo and theme toggle. The theme choice (light/dark) is remembered.
- **MongoDB database `insight-ai`:** `users` (bcrypt password hashes), `datasets` (metadata), `dataset_files.*` (GridFS copy of each original upload), `conversations` and `messages` (chat history, each conversation tied to the file it used).
- **Upload your data:** `.csv` or `.xlsx` up to 25 MB / 200k rows; each Excel sheet becomes a table. Columns are cleaned to snake_case, numbers like `1,200.50` and date columns are detected, and the data is loaded into a per-dataset read-only SQLite file (rebuilt from MongoDB if the cache is missing). The same RAG -> Text-to-SQL -> validator -> executor pipeline then runs against it, with the table allowlist set to that file's tables only.
- **History:** every chat is saved per user. Each history entry shows the file it was run on; clicking one restores the full conversation. If a file is later deleted, its chats stay readable and are marked "removed".
- **Auth:** JWT bearer token (7 days) in localStorage; every dataset and conversation endpoint checks ownership, so users can only see their own data.

## Demo script (5 minutes)

1. Click **Top 5 products last month**: watch the Agent Brain light up, then show the chart, expand the SQL, read the insights.
2. Click a **follow-up chip**, edit it, send it.
3. Ask **Revenue by month for the last 6 months** (line chart) and **How many orders are in each status?** (pie).
4. Open **Schema Explorer** in the sidebar to show what the RAG layer indexes.
5. Security: type `DROP TABLE customers`, `SELECT * FROM sqlite_master`, `Show me all customers; DROP TABLE orders`. Each shows a red blocked card with the rejected SQL and nothing reaches the database.

All questions and expected outcomes: [demo/sample_questions.md](demo/sample_questions.md).

## Security model (defence in depth)

| Layer | Protection |
|-------|-----------|
| Validator (sqlparse) | Exactly one statement; must start with SELECT/WITH; blocks DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, ATTACH, DETACH, PRAGMA, VACUUM, REPLACE; blocks `sqlite_master`/`sqlite_schema` and other `sqlite_*` internals; rejects suspicious keywords hidden in comments; every table in FROM/JOIN must be in the 5-table allowlist (CTE names allowed); schema-qualified names other than `main.` rejected |
| Executor | SQLite opened with `mode=ro` + `PRAGMA query_only=ON`; 5 s timeout via progress handler; at most 1000 rows fetched |
| Raw SQL input | Inputs that already look like SQL or stacked statements go straight to the validator (no LLM in the loop), so the gate is deterministic |
| Secrets | API keys only from `backend/.env` locally / Render environment variables (never committed) |

## Design decisions

- **Models.** The brief names Gemini 2.5 Flash and `text-embedding-004`. Both are retired for new API keys, so defaults are `gemini-3.5-flash` (fallback `gemini-3.1-flash-lite`) and `gemini-embedding-001`. All are configurable in `.env`. Newest models were intermittently overloaded during development, hence the per-call timeout, fallback chain and a 2-minute cooldown for failing models.
- **Embeddings fallback.** If Gemini embeddings fail, the index is rebuilt with a local hashed bag-of-words embedder (no downloads). The embedder used is stored in the collection metadata.
- **Retrieval.** Top-3 table chunks, plus join-path neighbours (e.g. `order_items` pulls in `orders` and `products`) so the LLM always sees the join keys.
- **Chart rules.** The brief lists bar (<=8) before pie (<=5), which would make pie unreachable. Pie is used for 2-5 part-of-whole categories (status, category, country, share...); bar for up to 12 categories; line for temporal + numeric; scatter for two numerics; KPI for a single-row numeric result; otherwise table. Any recommender failure falls back to table.
- **Self-repair.** If generated SQL fails at execution, it is regenerated once with the error appended. Validation failures are never retried (blocked immediately).
- **Fallbacks.** Gemini -> Gemini fallback model -> Groq (if `GROQ_API_KEY` set) -> canned SQL for the headline demo questions -> clear error card. Insights fall back to pandas-computed statements.
- **Trace.** `/api/ask` returns the full trace in one response; the UI animates it step by step (streaming via SSE would be the next step).
- **UI.** Hand-rolled shadcn-style components (Tailwind), no shadcn CLI dependency. Below 1024 px the sidebar is hidden and the Agent Brain becomes a tab.
- Dates in the sample DB are generated relative to the day of seeding so "last month" always works. Re-seed with `python -m app.db.seed` (then delete `backend/chroma_store` only if you change the schema).

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ask` (auth) | `{question, dataset_id, conversation_id?}` -> trace, status (`ok`/`blocked`/`error`), sql, data, chart, insights, followups, total_ms. Always HTTP 200 for pipeline outcomes |
| `POST /api/auth/signup`, `/login`, `GET /api/auth/me`, `POST /api/auth/change-password` | Accounts |
| `GET /api/datasets`, `POST /api/datasets` (multipart file), `DELETE /api/datasets/{id}` | Sample + uploaded datasets |
| `GET /api/schema?dataset_id=` | Tables and columns for the explorer |
| `POST /api/ask/cancel` (auth) | `{request_id}` - Stop button: the pipeline checks the flag between steps and the answer is not saved |
| `POST /api/conversations/{id}/truncate` (auth) | `{keep_exchanges}` - used when a prompt is edited: drops the later question/answer pairs |
| `GET /api/history`, `GET/DELETE /api/conversations/{id}`, `POST /api/reset-history` | Saved chats |
| `GET /api/health` | `{status, llm:{gemini,groq}, mongo}` |

## Future work (designed for production, stubbed for prototype)

- **Kafka**: stream query/audit events and decouple long-running analyses.
- **Redis**: cache SQL and results per question, rate limiting, persistent session history.
- **FAISS / pgvector**: larger schema catalogues and query-example retrieval.
- Spring Boot gateway for auth and multi-tenant routing; per-user table permissions; SSE streaming of the trace; evaluation harness for SQL accuracy.

## Project layout

```
backend/.env(.example)  secrets (gitignored) / template
backend/app/{main,config,llm,pipeline,models,auth,mongo,datasets,conversations,dataset_ctx}.py
backend/app/db/      seed.py, schema_meta.py, sample.db (generated)
backend/app/rag/     indexer.py, retriever.py
backend/app/agent/   text2sql.py, validator.py, executor.py, analyzer.py, insights.py
frontend/src/        App.tsx, pages/, components/, context/ (auth, theme), hooks/useChat.ts, api/client.ts
demo/                sample_questions.md, architecture.md
frontend/vercel.json, DEPLOY.md   deployment (Render + Vercel + Atlas)
```
