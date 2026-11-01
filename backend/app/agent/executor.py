"""Safe SQL execution: read-only connection, row cap, wall-clock timeout."""
from __future__ import annotations

import sqlite3
import time

from app import config


class ExecutionError(RuntimeError):
    """Raised for SQL errors, timeouts and other execution failures."""


def execute(sql: str, db_path=None) -> tuple[list[dict], bool]:
    """Run `sql` and return (rows, truncated).

    Defence in depth on top of the validator:
      * connection opened with mode=ro (SQLite refuses writes)
      * PRAGMA query_only=ON
      * progress handler aborts queries running longer than QUERY_TIMEOUT_S
      * at most ROW_LIMIT rows are fetched
    """
    uri = f"file:{(db_path or config.DB_PATH).as_posix()}?mode=ro"
    con = sqlite3.connect(uri, uri=True, timeout=config.QUERY_TIMEOUT_S)
    con.execute("PRAGMA query_only = ON")
    deadline = time.monotonic() + config.QUERY_TIMEOUT_S
    con.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10_000)
    try:
        cur = con.execute(sql.strip().rstrip(";"))
        cols = _unique([d[0] for d in cur.description or []])
        fetched = cur.fetchmany(config.ROW_LIMIT + 1)
    except sqlite3.OperationalError as exc:
        msg = "Query timed out after %ss" % config.QUERY_TIMEOUT_S if "interrupted" in str(exc) else str(exc)
        raise ExecutionError(msg) from exc
    except sqlite3.Error as exc:
        raise ExecutionError(str(exc)) from exc
    finally:
        con.close()
    truncated = len(fetched) > config.ROW_LIMIT
    return [dict(zip(cols, r)) for r in fetched[:config.ROW_LIMIT]], truncated


def _unique(names: list[str]) -> list[str]:
    """Disambiguate duplicate column names (a, a_2, ...)."""
    seen: dict[str, int] = {}
    out = []
    for n in names:
        seen[n] = seen.get(n, 0) + 1
        out.append(n if seen[n] == 1 else f"{n}_{seen[n]}")
    return out
