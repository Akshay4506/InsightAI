"""Agentic pipeline orchestrator.

Retrieve schema -> generate SQL -> validate -> execute -> analyze -> insights,
recording a trace entry (step, ms, status, detail) for every stage. Never raises:
every failure becomes a response with status "blocked" or "error".
"""
from __future__ import annotations

import re
import threading
import time

from app import llm
from app.dataset_ctx import SAMPLE, DatasetContext
from app.agent import analyzer, executor, insights, text2sql, validator
from app.models import AskResponse, Chart, TraceStep
from app.rag import retriever

# Input that is already raw SQL (or a stacked/destructive statement) goes straight
# to the validator instead of the LLM, so the security gate is demonstrable and deterministic.
_DANGEROUS = r"drop|delete|update|insert|alter|truncate|create|attach|detach|pragma|vacuum|replace"
_RAW_SQL = re.compile(rf"^\s*({_DANGEROUS}|select|with)\b|;\s*({_DANGEROUS}|select)\b", re.I)

FRIENDLY_LLM_DOWN = ("No LLM provider is reachable. Set GEMINI_API_KEY (or GROQ_API_KEY) in .env "
                     "and restart the backend.")


class Cancelled(Exception):
    """The user pressed Stop: abandon the remaining steps."""


class _Run:
    """Collects trace steps with timing."""

    def __init__(self, question: str, cancel: threading.Event | None = None):
        self.question = question
        self.cancel = cancel
        self.trace: list[TraceStep] = []
        self.t0 = time.perf_counter()

    def step(self, name: str, started: float, status: str = "ok", detail: str | None = None):
        self.trace.append(TraceStep(step=name, ms=int((time.perf_counter() - started) * 1000),
                                    status=status, detail=detail))

    def check(self) -> None:
        if self.cancel is not None and self.cancel.is_set():
            raise Cancelled

    def total(self) -> int:
        return int((time.perf_counter() - self.t0) * 1000)

    def fail(self, status: str, error: str, sql: str | None = None) -> AskResponse:
        return AskResponse(question=self.question, trace=self.trace, status=status, error=error,
                           sql=sql, total_ms=self.total())


# SQL the model writes to list columns (pragma_table_info('t'), pragma_table_xinfo, ...).
_INTROSPECTION = re.compile(r"pragma_\w+", re.I)
SCHEMA_RETRY_HINT = (
    "Listing columns with pragma_table_info / pragma_* is blocked. The full schema is already shown above, so answer "
    "from it: return ONE SELECT made only of literal values copied from the schema, e.g. "
    "SELECT 'customer_id' AS column_name, 'customers' AS in_table UNION ALL SELECT 'region', 'orders'. "
    "For 'columns in common' list only the column names that appear in both tables.")


def run(question: str, ctx: DatasetContext = SAMPLE, cancel: threading.Event | None = None) -> AskResponse:
    """Execute the full pipeline for one question. `cancel` is checked between steps."""
    r = _Run(question, cancel)
    try:
        return _run(r, question, ctx)
    except Cancelled:
        return r.fail("error", "Stopped")
    except Exception as exc:  # last-resort guard: the UI must never hang
        r.trace.append(TraceStep(step="Pipeline", ms=r.total(), status="error", detail=str(exc)[:200]))
        return r.fail("error", f"Unexpected error: {exc}")


def _run(r: _Run, question: str, ctx: DatasetContext) -> AskResponse:
    raw_sql_input = bool(_RAW_SQL.search(question))

    # 1. Schema retrieval (RAG)
    t = time.perf_counter()
    try:
        schema = retriever.retrieve(question, ctx)
        r.step("Schema Retrieval", t, detail=f"{len(schema['tables'])} tables ({', '.join(schema['tables'])})")
    except Exception as exc:
        r.step("Schema Retrieval", t, "error", str(exc)[:160])
        return r.fail("error", f"Schema retrieval failed: {exc}")

    r.check()

    # 2. SQL generation
    t = time.perf_counter()
    provider = ""
    if raw_sql_input:
        sql, provider = question.strip(), "direct"
        r.step("SQL Generation", t, detail="Raw SQL detected - sent straight to the validator")
    else:
        try:
            sql, provider = text2sql.generate_sql(question, schema["chunks"], ctx=ctx)
        except llm.LLMUnavailable as exc:
            sql = text2sql.canned_sql(question) if ctx.is_sample else None
            if sql is None:
                r.step("SQL Generation", t, "error", str(exc)[:160])
                return r.fail("error", FRIENDLY_LLM_DOWN)
            provider = "canned-fallback"
        r.step("SQL Generation", t, detail=provider)

    r.check()

    # 3. Validation (blocks short-circuit)
    t = time.perf_counter()
    ok, reason = validator.validate(sql, ctx.tables)
    if not ok and not raw_sql_input and _INTROSPECTION.search(sql):
        # The model tried to list columns with pragma_*(). That is blocked, but it is a model mistake, not an
        # attack: the schema is already in the prompt, so retry once and let it answer from that. The new SQL
        # is validated like any other (sqlite_master and everything else still block immediately).
        r.step("Validation", t, "blocked", f"{reason} - retrying: answer schema questions from the schema shown")
        t = time.perf_counter()
        try:
            sql, provider = text2sql.generate_sql(question, schema["chunks"], SCHEMA_RETRY_HINT, sql, ctx)
        except llm.LLMUnavailable:
            return r.fail("error", FRIENDLY_LLM_DOWN)
        r.step("SQL Generation", t, detail=f"{provider} (schema retry)")
        t = time.perf_counter()
        ok, reason = validator.validate(sql, ctx.tables)
    if not ok:
        r.step("Validation", t, "blocked", reason)
        return r.fail("blocked", reason, sql)
    r.step("Validation", t, detail="SELECT-only, single statement, tables allowlisted")

    r.check()

    # 4. Execution (one self-repair retry on SQL errors)
    t = time.perf_counter()
    try:
        rows, truncated = executor.execute(sql, ctx.db_path)
    except executor.ExecutionError as first_err:
        r.step("Execution", t, "error", f"{first_err} - retrying with error feedback")
        t = time.perf_counter()
        try:
            sql2, _ = text2sql.generate_sql(question, schema["chunks"], str(first_err), sql, ctx)
            ok, reason = validator.validate(sql2, ctx.tables)
            if not ok:
                r.step("Validation", t, "blocked", reason)
                return r.fail("blocked", reason, sql2)
            sql = sql2
            rows, truncated = executor.execute(sql, ctx.db_path)
        except (executor.ExecutionError, llm.LLMUnavailable) as exc:
            r.step("Execution", t, "error", str(exc)[:160])
            return r.fail("error", f"The generated SQL could not be executed: {exc}", sql)
    r.step("Execution", t, detail=f"{len(rows)} rows" + (" (truncated at limit)" if truncated else ""))

    if not rows:
        t = time.perf_counter()
        r.step("Analysis", t, "skipped", "no rows")
        return AskResponse(question=question, trace=r.trace, status="ok", sql=sql, data=[],
                           chart=Chart(), insights=[], followups=[
                               "What date range does the data cover?", "Show total revenue by month",
                               "Which products sell the most?"], total_ms=r.total())

    r.check()

    # 5. Analysis
    t = time.perf_counter()
    analysis = analyzer.analyze(rows)
    r.step("Analysis", t, detail=f"chart: {analysis['chart']['type']}")

    r.check()

    # 6. Insights
    t = time.perf_counter()
    out, src = insights.generate_insights(question, sql, analysis)
    r.step("Insights", t, detail=src)

    return AskResponse(
        question=question, trace=r.trace, status="ok", sql=sql, data=rows,
        chart=Chart(**analysis["chart"]), insights=out["insights"], followups=out["followups"],
        total_ms=r.total(), truncated=truncated)
