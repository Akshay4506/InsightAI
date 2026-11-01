"""Environment-driven configuration for InsightAI (no secrets in code)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
# Secrets live in backend/.env locally; on Render they are set as environment variables instead.
load_dotenv(BACKEND_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
GEMINI_FALLBACK_MODELS = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite").split(",") if m.strip()]
LLM_TIMEOUT_MS = int(os.getenv("LLM_TIMEOUT_MS", "25000"))
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

DB_PATH = BASE_DIR / "db" / "sample.db"
CHROMA_DIR = BACKEND_DIR / "chroma_store"
ALLOWED_TABLES = {"customers", "categories", "products", "orders", "order_items"}
ROW_LIMIT = 1000
QUERY_TIMEOUT_S = 5
# Browser origins allowed to call the API. localhost (any port) always works for development; add your deployed
# frontend with CORS_ORIGINS="https://your-app.vercel.app" (comma-separated, no trailing slash). To also allow
# Vercel preview deployments set CORS_ORIGIN_REGEX="https://your-app(-.*)?\.vercel\.app".
CORS_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
_LOCAL_ORIGIN = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
_EXTRA_REGEX = os.getenv("CORS_ORIGIN_REGEX", "").strip()
CORS_ORIGIN_REGEX = f"{_LOCAL_ORIGIN}|{_EXTRA_REGEX}" if _EXTRA_REGEX else _LOCAL_ORIGIN

# --- accounts, storage ---
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "insight-ai")
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
JWT_EXPIRE_DAYS = 7
DATA_CACHE_DIR = BACKEND_DIR / "data_cache"
MAX_UPLOAD_MB = 25
MAX_UPLOAD_ROWS = 200_000
