/** Shared types mirroring the FastAPI models. */
export type StepStatus = "ok" | "error" | "blocked" | "skipped";
export type ChartType = "bar" | "line" | "pie" | "scatter" | "kpi" | "table";

export interface TraceStep { step: string; ms: number; status: StepStatus; detail?: string | null }
export interface Chart { type: ChartType; x: string | null; y: string | null }

export interface AskResponse {
  question: string;
  trace: TraceStep[];
  status: "ok" | "blocked" | "error";
  error: string | null;
  sql: string | null;
  data: Record<string, string | number | null>[];
  chart: Chart;
  insights: string[];
  followups: string[];
  total_ms: number;
  truncated: boolean;
  conversation_id?: string | null;
  dataset_id?: string | null;
  dataset_name?: string | null;
}

export interface SchemaTable {
  table: string;
  columns: { name: string; type: string; pk?: boolean; fk?: string | null }[];
}

export interface User { id: string; name: string; email: string; phone: string; created_at: string }

export interface Dataset {
  id: string;
  name: string;
  kind: "sample" | "csv" | "xlsx";
  size: number;
  rows: number | null;
  tables: { table: string; rows: number | null; columns: { name: string; type: string }[] }[];
  suggestions: string[];
  created_at: string | null;
}

export interface ConversationSummary {
  id: string;
  title: string;
  dataset_id: string;
  dataset_name: string;
  dataset_available: boolean;
  updated_at: string;
}

export type Message =
  | { id: string; role: "user"; text: string; stopped?: boolean }
  | { id: string; role: "assistant"; result: AskResponse };

/** Canonical pipeline steps, used to render pending/skipped rows in the trace panel. */
export const PIPELINE_STEPS = ["Schema Retrieval", "SQL Generation", "Validation", "Execution", "Analysis", "Insights"];
