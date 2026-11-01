"""Second LLM call: natural-language insights + follow-up questions (JSON).

If the LLM is unavailable or returns bad JSON, deterministic pandas-based
insights are produced instead so the UI always has something useful.
"""
from __future__ import annotations

import json
import re

from app import llm

PROMPT = """You are a senior data analyst. A user asked a question about a dataset.

Question: {question}
SQL used: {sql}
Summary stats (JSON): {stats}
First {n} rows (JSON): {rows}

Write findings grounded ONLY in the numbers above (cite concrete values, percentages, comparisons).
Return a JSON object, nothing else:
{{"insights": ["<finding 1>", "<finding 2>", "<finding 3>"],
  "followups": ["<follow-up question 1>", "<follow-up question 2>", "<follow-up question 3>"]}}
Each insight is one sentence, max 28 words. Follow-ups are short natural questions answerable from the same database."""


def _parse_json(text: str) -> dict | None:
    """Parse the model output as a JSON object, tolerating fences/prose around it."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    match = re.search(r"\{.*\}", text, re.S)
    for candidate in (text, match.group(0) if match else None):
        try:
            data = json.loads(candidate) if candidate else None
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    return None


def generate_insights(question: str, sql: str, analysis: dict) -> tuple[dict, str]:
    """Return ({"insights": [...], "followups": [...]}, provider_or_'heuristic')."""
    rows = analysis["rows"][:20]
    prompt = PROMPT.format(question=question, sql=sql, n=len(rows),
                           stats=json.dumps(analysis["stats"], default=str)[:3000],
                           rows=json.dumps(rows, default=str)[:4000])
    try:
        text, provider = llm.generate(prompt, json_mode=True, temperature=0.3)
        data = _parse_json(text)
        if data and isinstance(data.get("insights"), list) and data["insights"]:
            return {"insights": [str(i) for i in data["insights"]][:3],
                    "followups": [str(f) for f in data.get("followups", [])][:3]}, provider
    except llm.LLMUnavailable:
        pass
    return heuristic_insights(analysis), "heuristic"


def heuristic_insights(analysis: dict) -> dict:
    """Pure-pandas fallback insights."""
    rows, chart, stats = analysis["rows"], analysis["chart"], analysis["stats"]
    out: list[str] = [f"The query returned {len(rows)} row{'s' if len(rows) != 1 else ''}."]
    y, x = chart.get("y"), chart.get("x")
    if y and rows and y in stats["columns"]:
        s = stats["columns"][y]
        top = max(rows, key=lambda r: r[y] or 0)
        label = f" ({top[x]})" if x and x in top else ""
        if s["sum"]:
            out.append(f"The highest {y} is {top[y]:,}{label}, about {top[y] / s['sum']:.0%} of the total.")
        out.append(f"{y} ranges from {s['min']:,} to {s['max']:,} with an average of {s['mean']:,}.")
    return {"insights": out[:3], "followups": [
        "Can you break this down by category?", "How does this compare to the previous period?",
        "Which customers contribute the most?"]}
