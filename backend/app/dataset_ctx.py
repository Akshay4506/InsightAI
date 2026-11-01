"""DatasetContext: everything the pipeline needs to query one dataset.

The built-in e-commerce sample and every user upload are both represented by a
DatasetContext (SQLite file + allowed tables + vector collection name).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from app import config

SAMPLE_ID = "sample"
MULTI_PREFIX = "multi:"  # dataset id for a combined chat: "multi:<id1>,<id2>,..."


@dataclass(frozen=True)
class DatasetContext:
    id: str
    name: str
    db_path: Path
    tables: frozenset[str]
    collection: str
    is_sample: bool = False
    row_count: int | None = None
    suggestions: tuple[str, ...] = field(default_factory=tuple)
    sources: tuple[tuple[str, str], ...] = ()  # (table, source file) when several files are combined

    @property
    def is_multi(self) -> bool:
        return self.id.startswith(MULTI_PREFIX)


SAMPLE = DatasetContext(
    id=SAMPLE_ID,
    name="Sample e-commerce data",
    db_path=config.DB_PATH,
    tables=frozenset(config.ALLOWED_TABLES),
    collection="schema",
    is_sample=True,
    suggestions=("Top 5 products last month", "Revenue by month for the last 6 months",
                 "Which city has the most customers?", "Best-selling category this quarter"),
)
