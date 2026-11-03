## What InsightAI Implements

| # | Research Gap | What We Implemented | Evidence We Have | Limits |
|---|---|---|---|---|
| 1 | Unsafe execution of LLM-generated SQL | Layered defence: a parser-based validator (one SELECT only, blocked keywords, table allowlist, no database-internals access), a read-only connection, a 5 s timeout and a 1000-row cap. SQL typed directly by the user skips the LLM and goes straight to the validator. | 6 required attack cases blocked, 30 validator unit tests passing, blocked queries shown with the rejected SQL | It limits the damage from prompt injection but doesn't detect it. Model backdoors are out of scope. |
| 2 | Schema hallucination from too little or too much context | RAG over schema: one chunk per table with types and example values, top-3 retrieval, join-neighbour expansion, a "use only these tables" rule, and a validator that rejects invented tables. One self-repair retry fixes bad columns. | The retrieved tables appear in the trace on every answer. A retry test passes. The real model answered cross-file column questions correctly. | Hallucination reduction was not measured. Small datasets skip ranking and get every table. |
| 3 | Systems stop at SQL or a table | Automatic chart choice (KPI, line, pie, bar, scatter, table), written insights and follow-up questions, with a fallback if the LLM fails | Verified on sample questions and on uploaded files | The chart choice is rule-based, not learned. |
| 4 | Black-box agentic analytics | Each answer shows its pipeline steps with timings, the generated SQL and the validation result. The trace is saved with the chat. Users can copy, edit and stop prompts. | Visible in the live app. Edit and stop were tested in Chrome. | The trace is returned in one response and then animated. It shows what happened, not the model's reasoning. |
| 5 | No data isolation between users | Login with hashed passwords and tokens, per-user ownership checks, and files tied to the chat they were uploaded in. The server rejects using another chat's files. | Cross-chat access returns 400, cross-user access returns 404, and the live site returns 401 without a token | This is tenant isolation. Role-based access (roles, table or column permissions) is future work. |
| 6 | Models are tested on fixed schemas, not users' own data | Upload CSV or Excel, then clean it, infer types, load it into SQLite, profile it and index it, with no fine-tuning | Tested with CSV and multi-sheet Excel | Files up to 25 MB and 200k rows. |
| 7 | Questions that span several tables or files | Multiple data mode merges the chosen files, tags each table with its source file, and infers join keys from shared column names and `X_id` patterns | Tested with related customer and order files: join answers and link detection | Join keys are guessed. Differently named linking columns rely on the model. |
| 8 | Dependence on a single LLM provider | Fallback chain: Gemini models with timeouts and cooldowns, then Groq, then canned SQL for the sample data, then a clear error | Exercised during development when models timed out | Only Gemini is configured in production right now. |
| 9 | One-shot Q&A instead of iterative analysis | Saved chats showing which file each used, follow-up suggestions, edit-and-rewind, stop generation, and background processing while you switch chats | Tested end to end in Chrome | — |
| 10 | Prototypes that are never deployed | Vercel frontend, Render API and MongoDB Atlas. The server rebuilds its caches from stored files if its disk is wiped. | Live site reachable. Health check shows the database and model connected. CORS allows your Vercel domain. | A cold start took 83 s on the free tier. No monitoring or rate limiting. |

### Future Work

- **Accuracy evaluation:** no benchmark or custom question set has been scored.
- **Role-based access control:** there is a single role, with no table or column permissions.
- **Prompt-injection detection:** none. Only damage limitation is in place.
- **Clarifying questions:** ambiguous questions get a best guess instead of a question back.
- **Rate limiting, audit log and streaming:** not built.