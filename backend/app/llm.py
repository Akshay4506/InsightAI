"""Unified LLM + embedding client: Gemini first, Groq fallback, clear errors.

`generate()` raises LLMUnavailable when no provider can answer so the pipeline
can degrade gracefully (canned SQL for demo questions, friendly UI message).
"""
from __future__ import annotations

import hashlib
import math
import re
import time

from app import config


class LLMUnavailable(RuntimeError):
    """Raised when no configured LLM provider could produce a response."""


_gemini = None
_groq = None
COOLDOWN_S = 120
_cooldown: dict[str, float] = {}  # model -> monotonic time until which it is skipped


def _gemini_client():
    global _gemini
    if _gemini is None and config.GEMINI_API_KEY:
        from google import genai
        from google.genai import types
        _gemini = genai.Client(api_key=config.GEMINI_API_KEY,
                               http_options=types.HttpOptions(timeout=config.LLM_TIMEOUT_MS))
    return _gemini


def _groq_client():
    global _groq
    if _groq is None and config.GROQ_API_KEY:
        from groq import Groq
        _groq = Groq(api_key=config.GROQ_API_KEY)
    return _groq


def provider_status() -> dict:
    """Which providers are configured (never exposes keys)."""
    return {"gemini": bool(config.GEMINI_API_KEY), "groq": bool(config.GROQ_API_KEY)}


def generate(prompt: str, *, json_mode: bool = False, temperature: float = 0.1) -> tuple[str, str]:
    """Return (text, provider_name). Tries Gemini, then Groq."""
    errors: list[str] = []
    client = _gemini_client()
    if client is not None:
        from google.genai import types
        cfg = types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type="application/json" if json_mode else None)
        now = time.monotonic()
        for model in [config.GEMINI_MODEL, *config.GEMINI_FALLBACK_MODELS]:
            if _cooldown.get(model, 0) > now:
                continue  # recently failed; skip to avoid paying the timeout again
            try:
                res = client.models.generate_content(model=model, contents=prompt, config=cfg)
                if res.text:
                    return res.text, f"gemini:{model}"
                errors.append(f"{model}: empty response")
            except Exception as exc:  # overload, quota, retired model, network
                _cooldown[model] = time.monotonic() + COOLDOWN_S
                errors.append(f"{model}: {str(exc)[:120]}")
    groq = _groq_client()
    if groq is not None:
        try:
            kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
            res = groq.chat.completions.create(
                model=config.GROQ_MODEL, temperature=temperature,
                messages=[{"role": "user", "content": prompt}], **kwargs)
            return res.choices[0].message.content or "", f"groq:{config.GROQ_MODEL}"
        except Exception as exc:
            errors.append(f"groq: {str(exc)[:160]}")
    if not errors:
        errors.append("no LLM configured - set GEMINI_API_KEY (or GROQ_API_KEY) in .env")
    raise LLMUnavailable("; ".join(errors))


# ---------------------------------------------------------------- embeddings
_DIM = 256


def local_embed(texts: list[str]) -> list[list[float]]:
    """Dependency-free hashed bag-of-words embedding (offline fallback)."""
    out = []
    for t in texts:
        vec = [0.0] * _DIM
        for tok in re.findall(r"[a-z0-9]+", t.lower()):
            h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
            vec[h % _DIM] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        out.append([v / norm for v in vec])
    return out


def gemini_embed(texts: list[str]) -> list[list[float]]:
    """Embed with Gemini; raises on failure."""
    client = _gemini_client()
    if client is None:
        raise LLMUnavailable("GEMINI_API_KEY not set")
    res = client.models.embed_content(model=config.GEMINI_EMBED_MODEL, contents=texts)
    return [list(e.values) for e in res.embeddings]
