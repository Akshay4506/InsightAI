/** Thin fetch wrapper around the backend API (adds the bearer token, normalises errors). */
import type { AskResponse, ConversationSummary, Dataset, Message, SchemaTable, User } from "../types";

// Backend origin for deployed builds (e.g. https://insightai-api.onrender.com). Trailing slashes and a trailing
// "/api" are stripped so a slightly wrong value cannot produce paths like /api/api/auth/signup.
const BASE = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "").replace(/\/api$/i, "");
const TOKEN_KEY = "insightai-token";

export class BackendUnreachable extends Error {}
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e; // user pressed Stop
    throw new BackendUnreachable("Backend unreachable");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail[0]?.msg ?? msg;
    } catch { /* non-JSON error body */ }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  // auth
  signup: (b: { name: string; email: string; phone: string; password: string; confirm_password: string }) =>
    req<{ token: string; user: User }>("/api/auth/signup", json(b)),
  login: (identifier: string, password: string) =>
    req<{ token: string; user: User }>("/api/auth/login", json({ identifier, password })),
  me: () => req<{ user: User }>("/api/auth/me"),
  changePassword: (b: { old_password: string; new_password: string; confirm_password: string }) =>
    req<{ status: string }>("/api/auth/change-password", json(b)),

  // datasets
  /** Files uploaded in one chat (datasets are scoped to the chat they were uploaded in). */
  datasets: (conversationId: string) => req<Dataset[]>(`/api/datasets?conversation_id=${encodeURIComponent(conversationId)}`),
  upload: (file: File, conversationId?: string | null) => {
    const fd = new FormData();
    fd.append("file", file);
    if (conversationId) fd.append("conversation_id", conversationId);
    return req<Dataset & { conversation_id: string }>("/api/datasets", { method: "POST", body: fd });
  },
  deleteDataset: (id: string) => req<{ status: string }>(`/api/datasets/${id}`, { method: "DELETE" }),
  renameDataset: (id: string, name: string) => req<Dataset>(`/api/datasets/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  preview: (id: string, table?: string) =>
    req<{ name: string; tables: string[]; table: string; columns: string[]; rows: Record<string, string | number | null>[]; total_rows: number; limit: number }>(
      `/api/datasets/${id}/preview${table ? `?table=${encodeURIComponent(table)}` : ""}`),
  schema: (datasetId: string) => req<{ tables: SchemaTable[] }>(`/api/schema?dataset_id=${datasetId}`),

  // chat
  ask: (question: string, dataset_id: string, conversation_id: string | null, request_id?: string, signal?: AbortSignal) =>
    req<AskResponse>("/api/ask", { ...json({ question, dataset_id, conversation_id, request_id }), signal }),
  cancelAsk: (request_id: string) => req<{ status: string }>("/api/ask/cancel", json({ request_id })),
  truncateConversation: (id: string, keep_exchanges: number) =>
    req<{ status: string }>(`/api/conversations/${id}/truncate`, json({ keep_exchanges })),
  history: () => req<ConversationSummary[]>("/api/history"),
  conversation: (id: string) =>
    req<{ conversation: ConversationSummary; messages: { id: string; role: "user" | "assistant"; text?: string; result?: AskResponse }[] }>(`/api/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    req<{ id: string; title: string }>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => req<{ status: string }>(`/api/conversations/${id}`, { method: "DELETE" }),
  resetHistory: () => req<{ status: string }>("/api/reset-history", { method: "POST" }),
};

export function toMessages(raw: { id: string; role: "user" | "assistant"; text?: string; result?: AskResponse }[]): Message[] {
  return raw.map((m) => m.role === "user"
    ? { id: m.id, role: "user", text: m.text ?? "" }
    : { id: m.id, role: "assistant", result: m.result as AskResponse });
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
