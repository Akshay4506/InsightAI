/**
 * Workspace state: per-chat datasets, single/multi dataset selection, per-chat threads, history, toasts.
 *
 * Lives in a provider above the routes (see context/ChatContext.tsx), so a question keeps processing
 * when the user opens another chat or leaves the page. Datasets, messages and "pending" are tracked per
 * chat: a file belongs to the chat it was uploaded in, and an answer lands in the chat it was asked from.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, BackendUnreachable, isAbort, toMessages } from "../api/client";
import type { ConversationSummary, Dataset, Message } from "../types";

let counter = 0;
const uid = () => `m${Date.now()}-${counter++}`;
const draftKey = () => `draft-${Date.now()}-${counter++}`;
const isDraft = (k: string) => k.startsWith("draft-");
const MULTI = "multi:";
const humanize = (s: string) => s.replace(/_/g, " ");

type Meta = { name: string; available: boolean };

export function useChat(onUnauthorized: () => void, enabled = true) {
  const [activeId, setActiveId] = useState("");
  const [multi, setMulti] = useState(false);
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [toast, setToast] = useState<{ text: string; tone: "error" | "ok" } | null>(null);

  // Per-chat state. A key is a conversation id, or a "draft-..." key until the chat is first saved.
  const [viewKey, setViewKey] = useState(draftKey);
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [metas, setMetas] = useState<Record<string, Meta>>({});
  const [datasetsByChat, setDatasetsByChat] = useState<Record<string, Dataset[]>>({});
  const [pending, setPending] = useState<string[]>([]);
  const viewRef = useRef(viewKey);
  viewRef.current = viewKey;
  /** Requests in flight per chat, so Stop can abort the right one. */
  const inflight = useRef<Record<string, { ctrl: AbortController; id: string }>>({});

  const fail = useCallback((e: unknown, fallback = "Something went wrong") => {
    if (e instanceof ApiError && e.status === 401) return onUnauthorized();
    setToast({ tone: "error", text: e instanceof BackendUnreachable ? "Backend unreachable" : e instanceof Error ? e.message : fallback });
  }, [onUnauthorized]);

  const refreshHistory = useCallback(() => api.history().then(setHistory).catch((e) => fail(e)), [fail]);

  useEffect(() => {
    if (!enabled) return;
    void refreshHistory().finally(() => setReady(true));
  }, [enabled, refreshHistory]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const messages = threads[viewKey] ?? [];
  const conversationId = isDraft(viewKey) ? null : viewKey;
  const datasets = datasetsByChat[viewKey] ?? [];
  const conversationDataset = metas[viewKey] ?? null;
  const loading = pending.includes(viewKey);
  /** A saved chat whose files were all deleted: readable, but there is nothing left to query. */
  const readOnly = !isDraft(viewKey) && viewKey in datasetsByChat && datasets.length === 0 && messages.length > 0;

  const active = useMemo(() => datasets.find((d) => d.id === activeId) ?? datasets[datasets.length - 1] ?? null, [datasets, activeId]);
  /** Datasets the current question runs on (one, or the checked ones in multiple mode). */
  const inUse = useMemo(
    () => (multi ? datasets.filter((d) => multiIds.includes(d.id)) : active ? [active] : []),
    [multi, datasets, multiIds, active]);
  const datasetId = multi ? (inUse.length >= 2 ? MULTI + inUse.map((d) => d.id).sort().join(",") : "") : active?.id ?? "";
  const activeName = inUse.map((d) => d.name).join(" + ");

  /** Starter questions: from the file itself, or cross-file ones when several are combined. */
  const suggestions = useMemo(() => {
    if (!multi) return active?.suggestions ?? [];
    if (inUse.length < 2) return [];
    const t = inUse.map((d) => humanize(d.tables[0]?.table ?? d.name));
    return [
      `What is the link between ${t[0]} and ${t[1]}?`,
      `Which columns do ${t[0]} and ${t[1]} have in common?`,
      `Join ${t[0]} with ${t[1]} and show the first 10 rows`,
      `How many ${t[0]} records have a match in ${t[1]}?`,
    ];
  }, [multi, active, inUse]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    const key = viewKey;
    if (!q || pending.includes(key) || readOnly || !datasetId) return;
    const userId = uid();
    const ctrl = new AbortController();
    const requestId = uid();
    inflight.current[key] = { ctrl, id: requestId };
    setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { id: userId, role: "user", text: q }] }));
    setPending((p) => [...p, key]);
    try {
      const result = await api.ask(q, datasetId, isDraft(key) ? null : key, requestId, ctrl.signal);
      const newKey = result.conversation_id ?? key;
      const meta = { name: result.dataset_name ?? "", available: true };
      setThreads((t) => {
        const next = { ...t };
        const cur = next[key] ?? [];
        if (newKey !== key) delete next[key];
        next[newKey] = [...cur, { id: uid(), role: "assistant", result }];
        return next;
      });
      setMetas((m) => { const next = { ...m }; if (newKey !== key) delete next[key]; next[newKey] = meta; return next; });
      setViewKey((v) => (v === key ? newKey : v));
      if (viewRef.current !== key && viewRef.current !== newKey) {
        setToast({ tone: "ok", text: `Answer ready: "${q.length > 40 ? q.slice(0, 40) + "..." : q}"` });
      }
    } catch (e) {
      if (isAbort(e)) {  // stopped by the user: keep the question, flag it, nothing was saved on the server
        setThreads((t) => ({ ...t, [key]: (t[key] ?? []).map((m) => (m.role === "user" && m.id === userId ? { ...m, stopped: true } : m)) }));
      } else fail(e);
    } finally {
      delete inflight.current[key];
      setPending((p) => p.filter((k) => k !== key));
      void refreshHistory();
    }
  }, [viewKey, pending, readOnly, datasetId, fail, refreshHistory]);

  /** Stop the answer being generated in the chat you are viewing. */
  const stop = useCallback(() => {
    const f = inflight.current[viewKey];
    if (!f) return;
    void api.cancelAsk(f.id).catch(() => undefined);  // tell the server so it stops and does not save the answer
    f.ctrl.abort();
  }, [viewKey]);

  /** Edit a question: rewind the chat to just before it (also on the server), then ask the new text. */
  const edit = useCallback(async (index: number, text: string) => {
    const key = viewKey;
    if (pending.includes(key) || readOnly) return;
    const keep = (threads[key] ?? []).slice(0, index).filter((m) => m.role === "assistant").length;
    if (!isDraft(key)) {
      try { await api.truncateConversation(key, keep); } catch (e) { fail(e); return; }
    }
    setThreads((t) => ({ ...t, [key]: (t[key] ?? []).slice(0, index) }));
    await ask(text);
  }, [viewKey, pending, readOnly, threads, ask, fail]);

  /** A new chat starts empty: it has no files until one is uploaded into it. */
  const newChat = useCallback(() => {
    setViewKey(draftKey());
    setMulti(false);
    setMultiIds([]);
    setActiveId("");
  }, []);

  // Choosing files only changes what the next question runs on; it never leaves the chat.
  const selectDataset = useCallback((id: string) => { setMulti(false); setActiveId(id); }, []);

  /** Switch to (or change the selection of) the "Multiple data" mode. Needs at least two files in the chat. */
  const selectMulti = useCallback((ids?: string[]) => {
    const next = (ids ?? (multiIds.length >= 2 ? multiIds : datasets.map((d) => d.id))).slice(0, 6);
    if (next.length < 2) return;
    setMulti(true);
    setMultiIds(next);
  }, [multiIds, datasets]);

  const openConversation = useCallback(async (id: string) => {
    try {
      const [r, ds] = await Promise.all([api.conversation(id), api.datasets(id)]);
      const c = r.conversation;
      const have = new Set(ds.map((d) => d.id));
      const used = c.dataset_id.startsWith(MULTI) ? c.dataset_id.slice(MULTI.length).split(",") : [c.dataset_id];
      if (used.length > 1 && used.every((x) => have.has(x))) { setMulti(true); setMultiIds(used); }
      else { setMulti(false); setActiveId(have.has(c.dataset_id) ? c.dataset_id : ds[ds.length - 1]?.id ?? ""); }
      setDatasetsByChat((m) => ({ ...m, [id]: ds }));
      // A question still processing for this chat is only in local state: keep it rather than the saved copy.
      setThreads((t) => (pending.includes(id) && t[id] ? t : { ...t, [id]: toMessages(r.messages) }));
      setMetas((m) => ({ ...m, [id]: { name: c.dataset_name, available: ds.length > 0 } }));
      setViewKey(id);
    } catch (e) { fail(e); }
  }, [pending, fail]);

  const dropChat = useCallback((id: string) => {
    setThreads((t) => { const n = { ...t }; delete n[id]; return n; });
    setDatasetsByChat((d) => { const n = { ...d }; delete n[id]; return n; });
  }, []);

  /** Deleting a chat also deletes the files uploaded in it. */
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      dropChat(id);
      if (id === viewKey) newChat();
      void refreshHistory();
    } catch (e) { fail(e); }
  }, [viewKey, dropChat, newChat, refreshHistory, fail]);

  const clearHistory = useCallback(async () => {
    try { await api.resetHistory(); setThreads({}); setMetas({}); setDatasetsByChat({}); newChat(); setHistory([]); } catch (e) { fail(e); }
  }, [newChat, fail]);

  /** Upload into the current chat (a draft becomes a saved chat). Throws so the modal can show the message inline. */
  const upload = useCallback(async (file: File) => {
    const { conversation_id: key, ...ds } = await api.upload(file, conversationId);
    setDatasetsByChat((m) => ({ ...m, [key]: [...(m[key] ?? []), ds] }));
    setMetas((m) => ({ ...m, [key]: { name: ds.name, available: true } }));
    setViewKey(key);
    setMulti(false);
    setActiveId(ds.id);
    setToast({ tone: "ok", text: `${ds.name} uploaded - ${ds.rows?.toLocaleString()} rows ready` });
    void refreshHistory();
    return ds;
  }, [conversationId, refreshHistory]);

  const removeDataset = useCallback(async (id: string) => {
    try {
      await api.deleteDataset(id);
      const rest = multiIds.filter((x) => x !== id);
      setDatasetsByChat((m) => ({ ...m, [viewKey]: (m[viewKey] ?? []).filter((d) => d.id !== id) }));
      if (multi && multiIds.includes(id)) { setMultiIds(rest); if (rest.length < 2) { setMulti(false); setActiveId(rest[0] ?? ""); } }
      else if (id === activeId) setActiveId("");
      void refreshHistory();
    } catch (e) { fail(e); }
  }, [viewKey, multi, multiIds, activeId, refreshHistory, fail]);

  /** Rename a chat; throws so the sidebar can show the message inline. */
  const renameConversation = useCallback(async (id: string, title: string) => {
    await api.renameConversation(id, title);
    await refreshHistory();
  }, [refreshHistory]);

  /** Rename a file; throws so the picker can show the message inline. */
  const renameDataset = useCallback(async (id: string, name: string) => {
    const ds = await api.renameDataset(id, name);
    setDatasetsByChat((m) => ({ ...m, [viewKey]: (m[viewKey] ?? []).map((d) => (d.id === id ? { ...d, name: ds.name } : d)) }));
    void refreshHistory();
  }, [viewKey, refreshHistory]);

  const lastResult = [...messages].reverse().find((m) => m.role === "assistant");
  return {
    datasets, active, activeId: datasetId, multi, multiIds, inUse, activeName, suggestions, ready, conversationId, messages, history,
    loading, pendingIds: pending, toast, readOnly, conversationDataset,
    ask, stop, edit, newChat, selectDataset, selectMulti, openConversation, deleteConversation, clearHistory, upload, removeDataset, renameDataset, renameConversation,
    dismissToast: () => setToast(null),
    lastResult: lastResult && lastResult.role === "assistant" ? lastResult.result : null,
  };
}
