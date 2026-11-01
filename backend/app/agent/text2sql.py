"""Text-to-SQL: RAG schema chunks + business rules + few-shot -> one SELECT.

Also contains the last-resort canned SQL for the headline demo questions, used
only when no LLM provider is reachable.
"""
from __future__ import annotations

import re
from datetime import date

from app import llm
from app.dataset_ctx import SAMPLE, DatasetContext
from app.db.schema_meta import BUSINESS_RULES

FEW_SHOT = """\
Q: Top 5 products by revenue last month
SQL: SELECT p.name AS product, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE o.status != 'cancelled' AND o.order_date >= date('now','start of month','-1 month') AND o.order_date < date('now','start of month') GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5

Q: Revenue by month for the last 6 months
SQL: SELECT strftime('%Y-%m', o.order_date) AS month, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.status != 'cancelled' AND o.order_date >= date('now','start of month','-5 months') GROUP BY month ORDER BY month

Q: How many customers do we have in each city?
SQL: SELECT city, COUNT(*) AS customers FROM customers GROUP BY city ORDER BY customers DESC

Q: Which category sells the most units?
SQL: SELECT c.name AS category, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id JOIN categories c ON c.id = p.category_id WHERE o.status != 'cancelled' GROUP BY c.id, c.name ORDER BY units_sold DESC

Q: Show orders from the last week
SQL: SELECT id, customer_id, order_date, status, total_amount FROM orders WHERE order_date >= date('now','-7 days') ORDER BY order_date DESC

Q: How many orders are in each status?
SQL: SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC
"""

HARD_RULE = ("Return ONLY a single read-only SQLite SELECT statement. "
             "No prose, no markdown fences, no explanation.")


GENERIC_RULES = [
    "The data comes from a user-uploaded spreadsheet: rely only on the tables and columns shown above.",
    "Column and table names are lowercase snake_case; quote them with double quotes only if needed.",
    "Dates are stored as ISO text 'YYYY-MM-DD'; use SQLite date functions (strftime, date) on them.",
    "For 'top N' / 'most' questions use GROUP BY + ORDER BY ... DESC LIMIT N.",
    "Give computed columns readable aliases (total, average, count, ...).",
    "For 'show' / 'list' questions without an explicit limit, add LIMIT 100.",
    "SQL cannot list columns here: never use pragma_*, sqlite_master or information_schema (they are blocked). "
    "For questions about column names, attributes or what two tables have in common, answer with a SELECT of literal values "
    "copied from the schema above, e.g. SELECT 'customer_id' AS column_name, 'customers' AS in_table UNION ALL SELECT ...",
]

MULTI_RULES = [
    "The tables come from SEVERAL separate uploaded files; each table header names its source file.",
    "Relate files by joining on columns with the same meaning (see 'Possible join' lines and the example values).",
    "When asked how files or datasets are related, run a JOIN that shows the link (e.g. matched key counts, or a few joined rows).",
    "Use table aliases and qualify every column with its table to avoid ambiguity.",
]


def build_prompt(question: str, chunks: list[str], error: str | None = None, bad_sql: str | None = None,
                 ctx: DatasetContext = SAMPLE) -> str:
    """Assemble the Text-to-SQL prompt (optionally with a previous failure for the retry)."""
    rules = "\n".join(f"- {r}" for r in (BUSINESS_RULES if ctx.is_sample else GENERIC_RULES + (MULTI_RULES if ctx.is_multi else [])))
    examples = f"\n## Examples\n{FEW_SHOT}" if ctx.is_sample else ""
    prompt = (
        "You are an expert SQLite analyst. Translate the user's question into SQL.\n\n"
        f"Today's date is {date.today().isoformat()}.\n\n"
        "## Relevant schema\n" + "\n\n".join(chunks) +
        f"\n\n## Business rules\n{rules}\n{examples}\n"
        f"## Rule\n{HARD_RULE}\nUse only the tables shown above.\n\n"
        f"Q: {question}\nSQL:"
    )
    if error:
        prompt += (f"\n\nYour previous attempt failed.\nPrevious SQL: {bad_sql}\nError: {error}\n"
                   "Fix the problem and return ONLY the corrected SELECT statement.")
    return prompt


def clean_sql(raw: str) -> str:
    """Strip markdown fences / prose around the statement."""
    text = raw.strip()
    fence = re.search(r"```(?:sql)?\s*(.*?)```", text, re.S | re.I)
    if fence:
        text = fence.group(1).strip()
    text = re.sub(r"^\s*SQL:\s*", "", text, flags=re.I)
    m = re.search(r"\b(with|select)\b", text, re.I)
    if m and m.start() > 0:
        text = text[m.start():]
    return text.strip()


def generate_sql(question: str, chunks: list[str], error: str | None = None,
                 bad_sql: str | None = None, ctx: DatasetContext = SAMPLE) -> tuple[str, str]:
    """Return (sql, provider). Raises llm.LLMUnavailable if no provider works."""
    raw, provider = llm.generate(build_prompt(question, chunks, error, bad_sql, ctx))
    return clean_sql(raw), provider


# ------------------------------------------------------------- canned fallback
_REV = "ROUND(SUM(oi.quantity * oi.unit_price), 2)"
CANNED = [
    (r"top.*product|best.*product", "SELECT p.name AS product, " + _REV + " AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id WHERE o.status != 'cancelled' AND o.order_date >= date('now','start of month','-1 month') AND o.order_date < date('now','start of month') GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5"),
    (r"revenue.*month|monthly", "SELECT strftime('%Y-%m', o.order_date) AS month, " + _REV + " AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.status != 'cancelled' AND o.order_date >= date('now','start of month','-5 months') GROUP BY month ORDER BY month"),
    (r"city.*customer|customer.*city", "SELECT city, COUNT(*) AS customers FROM customers GROUP BY city ORDER BY customers DESC"),
    (r"categor", "SELECT c.name AS category, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id JOIN categories c ON c.id = p.category_id WHERE o.status != 'cancelled' AND o.order_date >= date('now','start of month','-' || ((CAST(strftime('%m','now') AS INTEGER)-1) % 3) || ' months') GROUP BY c.id, c.name ORDER BY units_sold DESC"),
    (r"last week|orders.*week", "SELECT id, customer_id, order_date, status, total_amount FROM orders WHERE order_date >= date('now','-7 days') ORDER BY order_date DESC"),
]


def canned_sql(question: str) -> str | None:
    """Last-resort SQL for the headline demo questions (no LLM available)."""
    q = question.lower()
    return next((sql for pat, sql in CANNED if re.search(pat, q)), None)
