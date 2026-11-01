"""SQL safety validator (sqlparse token/AST walk).

Rules enforced, in order:
  1. exactly one statement (no stacked queries)
  2. statement must be SELECT (optionally with a WITH/CTE prefix)
  3. no DDL/DML/admin keywords (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE,
     CREATE, ATTACH, DETACH, PRAGMA, VACUUM, REPLACE ...)
  4. no access to sqlite_master / sqlite_schema / sqlite_* internals
  5. comments may not hide suspicious keywords
  6. every table referenced in FROM/JOIN must be in the allowlist (CTE names OK)

`validate(sql)` returns (is_valid, reason).
"""
from __future__ import annotations

import re

import sqlparse
from sqlparse import tokens as T

from app.config import ALLOWED_TABLES

BLOCKED_KEYWORDS = {
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "CREATE", "ATTACH",
    "DETACH", "PRAGMA", "VACUUM", "REPLACE", "REINDEX", "ANALYZE", "GRANT", "REVOKE",
}
BLOCKED_FUNCTIONS = {"LOAD_EXTENSION", "READFILE", "WRITEFILE"}
_FROM_END = {"WHERE", "GROUP", "ORDER", "HAVING", "LIMIT", "UNION", "INTERSECT", "EXCEPT",
             "ON", "USING", "WINDOW", "SELECT"}
_SYS_RE = re.compile(r"sqlite_(master|schema|temp_master|temp_schema|sequence|stat\d*)", re.I)


def _significant(stmt) -> list:
    """Flattened tokens without whitespace/comments."""
    return [t for t in stmt.flatten()
            if not t.is_whitespace and t.ttype not in T.Comment]


def _cte_names(toks: list) -> set[str]:
    """Names introduced by `name AS (` patterns (CTEs)."""
    names = set()
    for i in range(len(toks) - 2):
        if (toks[i].ttype in T.Name or toks[i].ttype is T.Name) and toks[i + 1].normalized == "AS" \
                and toks[i + 2].value == "(":
            names.add(toks[i].value.strip('"`[]').lower())
    return names


def _tables(toks: list) -> list[str]:
    """Collect table names following FROM / JOIN (including comma lists)."""
    found: list[str] = []
    depth = 0
    expect = {}      # depth -> bool: next name token is a table
    in_list = {}     # depth -> bool: inside a FROM list at this depth (comma continues it)
    i = 0
    while i < len(toks):
        tok, val = toks[i], toks[i].value
        up = tok.normalized.upper() if tok.ttype in T.Keyword else ""
        if val == "(":
            depth += 1
            expect[depth] = in_list[depth] = False
            # a '(' right where a table was expected = subquery; keep scanning inside
        elif val == ")":
            expect.pop(depth, None)
            in_list.pop(depth, None)
            depth -= 1
        elif up == "FROM" or up.endswith("JOIN"):
            expect[depth] = True
            in_list[depth] = up == "FROM"
        elif up in _FROM_END or (up and up not in {"AS", "NATURAL", "LEFT", "RIGHT", "INNER", "OUTER",
                                                    "CROSS", "FULL", "DISTINCT", "ALL"}):
            if not up.endswith("JOIN"):
                in_list[depth] = False
        elif val == "," and in_list.get(depth):
            expect[depth] = True
        elif expect.get(depth) and tok.ttype in T.Name:
            # handle schema.table qualified names
            name, j = val, i
            if j + 2 < len(toks) and toks[j + 1].value == "." and toks[j + 2].ttype in T.Name:
                name = f"{val}.{toks[j + 2].value}"
                i += 2
            found.append(name.strip('"`[]').lower())
            expect[depth] = False
        elif expect.get(depth) and tok.ttype not in T.Keyword and val != "(":
            # string literal / other junk where a table should be
            found.append(val.strip('"`[]').lower())
            expect[depth] = False
        i += 1
    return found


def validate(sql: str, allowed: frozenset[str] | set[str] = ALLOWED_TABLES) -> tuple[bool, str]:
    """Return (is_valid, reason). `reason` is "ok" on success.

    `allowed` is the table allowlist of the dataset being queried."""
    if not sql or not sql.strip():
        return False, "Empty query"

    statements = [s for s in sqlparse.parse(sql) if str(s).strip().strip(";").strip()]
    if len(statements) != 1:
        return False, "Multiple statements are not allowed"
    stmt = statements[0]

    # comments: reject ones hiding dangerous keywords
    for tok in stmt.flatten():
        if tok.ttype in T.Comment:
            if any(re.search(rf"\b{k}\b", tok.value, re.I) for k in BLOCKED_KEYWORDS):
                return False, "Suspicious keyword inside a SQL comment"

    toks = _significant(stmt)
    if not toks:
        return False, "Empty query"

    first = toks[0].normalized.upper()
    if first not in {"SELECT", "WITH"}:
        return False, "Only SELECT queries are allowed"

    for i, t in enumerate(toks):
        word = t.normalized.upper()
        nxt = toks[i + 1].value if i + 1 < len(toks) else ""
        if word == "REPLACE":
            # replace(...) the string function is harmless; `REPLACE INTO` is a write
            if nxt != "(":
                return False, "Forbidden keyword: REPLACE"
            continue
        if t.ttype in T.Keyword or t.ttype in T.Keyword.DML or t.ttype in T.Keyword.DDL:
            if word in BLOCKED_KEYWORDS:
                return False, f"Forbidden keyword: {word}"
        if t.ttype in T.Name and word in BLOCKED_FUNCTIONS:
            return False, f"Forbidden function: {t.value}"

    if _SYS_RE.search(str(stmt)):
        return False, "Access to SQLite system tables is not allowed"

    ctes = _cte_names(toks)
    tables = _tables(toks)
    for name in tables:
        if "." in name:
            schema, name = name.split(".", 1)
            if schema != "main":
                return False, f"Schema '{schema}' is not allowed"
        if name in ctes:
            continue
        if name not in allowed:
            return False, f"Table '{name}' is not in the allowed list"
    return True, "ok"
