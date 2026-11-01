# Deploying InsightAI: MongoDB Atlas + Render (backend) + Vercel (frontend)

Order matters: **Atlas first, then Render, then Vercel, then one CORS fix on Render.**

```
Browser --> Vercel (React, static)  --VITE_API_URL-->  Render (FastAPI)  -->  MongoDB Atlas
                                                            |
                                                            +--> Gemini API
```

## 0. Before you start

1. Put the project on GitHub. From the `insightai` folder:
   ```bash
   git init
   git add .
   git status        # check that backend/.env is NOT listed (it is gitignored); backend/.env.example should be
   git commit -m "InsightAI"
   ```
   Create an empty repo on GitHub and push to it (`git remote add origin ... && git push -u origin main`).
2. **Rotate your Gemini API key** at https://aistudio.google.com/apikey if you have not already (it was shared in a chat). Use the new key below.
3. Secrets now live in **`backend/.env`** (local) and in Render's environment variables (production). Never in git.

## 1. MongoDB Atlas (database)

1. Sign up at https://www.mongodb.com/cloud/atlas and create a **free M0** cluster (any region, ideally close to your Render region).
2. **Database Access** -> Add Database User -> username + a strong password (use letters and digits only to avoid URL-encoding problems). Role: *Read and write to any database*.
3. **Network Access** -> Add IP Address -> **Allow access from anywhere (`0.0.0.0/0`)**. Render's free tier has no fixed IP, so a fixed allow-list is not possible. The database user's password is what protects it.
4. **Database** -> your cluster -> **Connect** -> **Drivers** -> copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>`. If it contains `@ : / ? # %`, URL-encode it (`@` becomes `%40`).
5. **Test it locally first.** In `backend/.env` set:
   ```
   MONGODB_URI=mongodb+srv://...your string...
   MONGODB_DB=insight-ai
   ```
   Restart the backend and open http://localhost:8000/api/health. It must show `"mongo": true`. Sign up in the app, then look in Atlas -> Browse Collections: the `insight-ai` database appears with `users`, `datasets`, `conversations`, `messages` and the `dataset_files.*` GridFS collections. You do not need to create anything by hand; collections and indexes are created on first use.

*(Optional) copy your existing local data to Atlas:*
```bash
mongodump --uri="mongodb://localhost:27017" --db=insight-ai --archive=insight.gz --gzip
mongorestore --uri="mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net" --archive=insight.gz --gzip
```

## 2. Render (backend)

Render dashboard -> New -> **Web Service** -> your repo, then:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |
| Instance type | Free (or Starter for no sleeping and more RAM) |

### 3. Environment variables on Render

| Key | Value |
|---|---|
| `PYTHON_VERSION` | `3.12.8` (the project's dependencies are not tested on Python 3.14; if Render rejects this exact version, pick a 3.12.x from its list) |
| `MONGODB_URI` | your Atlas `mongodb+srv://...` string |
| `MONGODB_DB` | `insight-ai` |
| `GEMINI_API_KEY` | your (rotated) key |
| `GEMINI_MODEL` | `gemini-3.5-flash` |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.1-flash-lite` |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-001` |
| `JWT_SECRET` | a long random string: `python -c "import secrets;print(secrets.token_hex(32))"` |
| `GROQ_API_KEY` | optional |
| `CORS_ORIGINS` | leave empty for now; set it in step 5 |

Deploy. When it is live, open `https://<your-service>.onrender.com/api/health`. Expect `{"status":"ok","llm":{"gemini":true,...},"mongo":true}`. If `mongo` is `false`, recheck the connection string and the Atlas network access rule.

Things to know about Render:
- **Free instances sleep after ~15 minutes idle**; the next request takes 30-60 seconds to wake it. Starter ($7/mo) does not sleep.
- **The disk is temporary.** That is fine here: uploaded files are stored in Atlas (GridFS), and the per-file SQLite copy and the vector index are rebuilt automatically when missing (the first question after a restart is a bit slower).
- **Memory:** the free tier has 512 MB. If the service restarts with an out-of-memory message in the logs, move to Starter.

## 4. Vercel (frontend)

1. https://vercel.com -> Add New -> **Project** -> import the same GitHub repo.
2. **Root Directory: `frontend`**. Framework preset: **Vite** (Build `npm run build`, Output `dist`; both are detected).
3. **Environment Variables:** `VITE_API_URL` = `https://<your-service>.onrender.com` (no trailing slash, no `/api`).
4. Deploy. `frontend/vercel.json` already makes deep links like `/analyze` and `/profile` work on refresh.

`VITE_API_URL` is baked in at build time. If you change it later, **redeploy** the frontend.

## 5. Allow the frontend to call the backend (CORS)

On Render -> your service -> Environment, set:

```
CORS_ORIGINS=https://<your-project>.vercel.app
```
No trailing slash. Several origins are comma-separated. To also allow Vercel's preview deployments:
```
CORS_ORIGIN_REGEX=https://<your-project>(-.*)?\.vercel\.app
```
Render redeploys automatically. Then open your Vercel URL, sign up, upload a CSV and ask a question.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Browser console: "blocked by CORS policy" | `CORS_ORIGINS` missing or has a typo / trailing slash; must match the Vercel URL exactly. |
| Login page says "Backend unreachable" | `VITE_API_URL` not set or wrong, or you did not redeploy Vercel after setting it. First request after idle can also just be the Render cold start; retry after a minute. |
| `/api/health` shows `"mongo": false` | Wrong URI/password, special characters not URL-encoded, or Atlas Network Access does not allow `0.0.0.0/0`. |
| Everyone is logged out after each deploy | `JWT_SECRET` not set on Render. |
| Render build fails on a package | Check `PYTHON_VERSION` is a 3.12 release. |
| 404 on refresh of `/analyze` | `frontend/vercel.json` missing from the deployed root directory. |
| Answers fail with "No LLM provider is reachable" | `GEMINI_API_KEY` not set on Render, or the key was revoked. |

## Local development (unchanged)

```bash
cd backend && cp .env.example .env     # fill in; then:  uvicorn app.main:app --reload
cd frontend && npm run dev             # the Vite dev server proxies /api to localhost:8000
```
