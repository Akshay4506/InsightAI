"""Pydantic request/response models for the API."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    dataset_id: str = "sample"
    conversation_id: Optional[str] = None
    request_id: Optional[str] = None  # lets the client cancel this request (Stop button)


class CancelRequest(BaseModel):
    request_id: str


class TraceStep(BaseModel):
    step: str
    ms: int
    status: Literal["ok", "error", "blocked", "skipped"]
    detail: Optional[str] = None


class Chart(BaseModel):
    type: Literal["bar", "line", "pie", "scatter", "kpi", "table"] = "table"
    x: Optional[str] = None
    y: Optional[str] = None


class AskResponse(BaseModel):
    question: str
    trace: list[TraceStep]
    status: Literal["ok", "blocked", "error"]
    error: Optional[str] = None
    sql: Optional[str] = None
    data: list[dict[str, Any]] = []
    chart: Chart = Chart()
    insights: list[str] = []
    followups: list[str] = []
    total_ms: int = 0
    truncated: bool = False
    conversation_id: Optional[str] = None
    dataset_id: Optional[str] = None
    dataset_name: Optional[str] = None
