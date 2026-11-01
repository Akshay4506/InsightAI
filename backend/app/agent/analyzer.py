"""pandas analysis + deterministic chart recommender.

Chart rules (first match wins):
  * single row with a numeric value              -> "kpi"
  * temporal + numeric                           -> "line"
  * categorical + numeric, 2-5 cats, share-like  -> "pie"
  * categorical + numeric, <= 12 cats            -> "bar"
  * two numeric columns (no categorical)         -> "scatter"
  * anything else / any failure                  -> "table"
The brief lists bar (<=8) before pie (<=5), which would make pie unreachable, so
pie is reserved for part-of-whole style columns (status, category, share...).
"""
from __future__ import annotations

import re

import pandas as pd

PIE_HINT = re.compile(r"status|categor|segment|country|type|channel|share|percent|pct", re.I)
TEMPORAL_HINT = re.compile(r"date|month|day|week|year|quarter|time|period", re.I)
DATE_VALUE = re.compile(r"^\d{4}-\d{2}(-\d{2})?([ T]\d{2}:\d{2}(:\d{2})?)?$")
ID_HINT = re.compile(r"(^id$|_id$)", re.I)
MAX_BAR_CATS = 12


def column_kinds(df: pd.DataFrame) -> dict[str, str]:
    """Classify each column as numeric / temporal / categorical."""
    kinds = {}
    for col in df.columns:
        s = df[col].dropna()
        if s.empty:
            kinds[col] = "categorical"
        elif pd.api.types.is_bool_dtype(s):
            kinds[col] = "categorical"
        elif pd.api.types.is_numeric_dtype(s):
            kinds[col] = "temporal" if re.fullmatch(r"year", col, re.I) else "numeric"
        elif s.astype(str).str.match(DATE_VALUE).all() or (
                TEMPORAL_HINT.search(col) and pd.to_datetime(s, errors="coerce").notna().all()):
            kinds[col] = "temporal"
        else:
            kinds[col] = "categorical"
    return kinds


def recommend_chart(df: pd.DataFrame, kinds: dict[str, str]) -> dict:
    """Return {type, x, y} for the result set; never raises."""
    try:
        nums = [c for c, k in kinds.items() if k == "numeric" and not ID_HINT.search(c)]
        cats = [c for c, k in kinds.items() if k == "categorical"]
        temps = [c for c, k in kinds.items() if k == "temporal"]
        if len(df) == 0:
            return {"type": "table", "x": None, "y": None}
        if len(df) == 1 and nums and len(cats) <= 1 and not temps:
            return {"type": "kpi", "x": cats[0] if cats else None, "y": nums[0]}
        if temps and nums and len(df) > 1:
            return {"type": "line", "x": temps[0], "y": nums[0]}
        if cats and nums:
            n = df[cats[0]].nunique()
            if 2 <= n <= 5 and PIE_HINT.search(cats[0] + " " + nums[0]) and (df[nums[0]] >= 0).all():
                return {"type": "pie", "x": cats[0], "y": nums[0]}
            if n <= MAX_BAR_CATS and len(cats) == 1:
                return {"type": "bar", "x": cats[0], "y": nums[0]}
        if len(nums) == 2 and not cats and not temps and len(df) > 1:
            return {"type": "scatter", "x": nums[0], "y": nums[1]}
        if len(nums) == 1 and not cats and not temps and len(df) == 1:
            return {"type": "kpi", "x": None, "y": nums[0]}
    except Exception:
        pass
    return {"type": "table", "x": None, "y": None}


def analyze(rows: list[dict]) -> dict:
    """Return {chart, table_columns, rows, kinds, stats} for the executed rows."""
    df = pd.DataFrame(rows)
    if df.empty:
        return {"chart": {"type": "table", "x": None, "y": None}, "table_columns": [],
                "rows": [], "kinds": {}, "stats": {}}
    kinds = column_kinds(df)
    stats: dict = {"row_count": int(len(df)), "columns": {}}
    for col in df.columns:
        info = {"kind": kinds[col], "unique": int(df[col].nunique(dropna=True)),
                "nulls": int(df[col].isna().sum())}
        if kinds[col] == "numeric":
            info.update(min=_f(df[col].min()), max=_f(df[col].max()),
                        mean=_f(df[col].mean()), sum=_f(df[col].sum()))
        stats["columns"][col] = info
    return {"chart": recommend_chart(df, kinds), "table_columns": list(df.columns),
            "rows": rows, "kinds": kinds, "stats": stats}


def _f(v) -> float | None:
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None
