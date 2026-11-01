/** Left column: New Analysis, chat history (rename / view files / delete per chat), security footer. */
import { Check, ExternalLink, Eye, FileSpreadsheet, History, Layers, Loader2, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import type { ConversationSummary, Dataset } from "../types";

interface Props {
  history: ConversationSummary[];
  activeConversation: string | null;
  pendingIds?: string[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onClearHistory: () => void;
}

export default function Sidebar({ history, activeConversation, pendingIds = [], onNew, onOpen, onDelete, onRename, onClearHistory }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const [files, setFiles] = useState<Dataset[] | null>(null);

  const save = async (h: ConversationSummary) => {
    const t = draft.trim();
    if (!t) { setErr("Name cannot be empty"); return; }
    if (t === h.title) { setEditing(null); return; }
    setBusy(true);
    try { await onRename(h.id, t); setEditing(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not rename"); }
    finally { setBusy(false); }
  };

  /** Eye: show which files this chat was run on (each opens in its own tab). */
  const toggleFiles = (id: string) => {
    if (shown === id) { setShown(null); return; }
    setShown(id);
    setFiles(null);
    api.datasets(id).then(setFiles).catch(() => setFiles([]));
  };

  const iconBtn = "rounded-md p-1 text-faint transition";

  return (
    <aside className="glass flex h-full min-h-0 w-full flex-col border-r border-ink/[0.06] p-4 lg:w-full">
      <button onClick={onNew}
        className="gradient-bg mb-5 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95">
        <Plus size={16} /> New Analysis
      </button>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <section>
          <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-widest text-faint">
            <span className="flex items-center gap-1.5"><History size={12} /> History</span>
            {history.length > 0 && (
              <button onClick={() => confirm("Delete all chats and the files uploaded in them?") && onClearHistory()} title="Clear history" aria-label="Clear history"
                className="hover:text-red-400"><Trash2 size={12} /></button>
            )}
          </div>
          {history.length === 0 && <p className="px-1 text-xs text-faint">No chats yet.</p>}
          <ul className="space-y-1">
            {history.map((h) => {
              const isEditing = editing === h.id;
              return (
                <li key={h.id} className={`rounded-lg transition ${h.id === activeConversation ? "bg-accent/15" : "hover:bg-ink/5"}`}>
                  {isEditing ? (
                    <div className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input autoFocus value={draft} maxLength={80} disabled={busy} aria-label="Chat name"
                          onChange={(e) => { setDraft(e.target.value); setErr(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") void save(h); if (e.key === "Escape") setEditing(null); }}
                          className="field !rounded-lg !px-2.5 !py-1.5 min-w-0 flex-1" />
                        <button onClick={() => void save(h)} disabled={busy} aria-label="Save name" title="Save"
                          className={`${iconBtn} text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50`}><Check size={14} /></button>
                        <button onClick={() => setEditing(null)} disabled={busy} aria-label="Cancel" title="Cancel"
                          className={`${iconBtn} hover:bg-ink/10 hover:text-fg`}><X size={14} /></button>
                      </div>
                      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
                    </div>
                  ) : (
                    <div className="flex items-start">
                      <button onClick={() => onOpen(h.id)} title={`${h.title}\nFile: ${h.dataset_name}`} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                        <span className="flex items-center gap-1.5 text-[13px] text-fg">
                          {pendingIds.includes(h.id) && <Loader2 size={12} className="shrink-0 animate-spin text-accent" aria-label="Processing" />}
                          <span className="truncate">{h.title}</span>
                        </span>
                        <span className={`mt-1 flex items-center gap-1 text-[11px] ${h.dataset_available ? "text-muted" : "text-faint line-through"}`}>
                          {h.dataset_id.startsWith("multi:") ? <Layers size={11} className="shrink-0 text-accent2" /> : <FileSpreadsheet size={11} className="shrink-0 text-accent2" />}
                          <span className="truncate">{h.dataset_name}</span>
                          {!h.dataset_available && <span className="no-underline">(removed)</span>}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 py-2 pr-1.5">
                        <button onClick={() => { setEditing(h.id); setDraft(h.title); setErr(""); }} aria-label="Rename chat" title="Rename chat"
                          className={`${iconBtn} hover:bg-accent/15 hover:text-accent`}><Pencil size={13} /></button>
                        <button onClick={() => toggleFiles(h.id)} aria-label="View files used" title="View files used in this chat" aria-expanded={shown === h.id}
                          className={`${iconBtn} hover:bg-accent/15 hover:text-accent ${shown === h.id ? "text-accent" : ""}`}><Eye size={13} /></button>
                        <button onClick={() => confirm("Delete this chat and the files uploaded in it?") && onDelete(h.id)} aria-label="Delete chat" title="Delete chat and its files"
                          className={`${iconBtn} hover:bg-red-500/15 hover:text-red-400`}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  )}

                  {shown === h.id && !isEditing && (
                    <div className="mx-2.5 mb-2 border-t border-ink/10 pt-1.5">
                      {files === null ? (
                        <p className="flex items-center gap-1.5 py-1 text-[11px] text-faint"><Loader2 size={11} className="animate-spin" /> Loading files...</p>
                      ) : files.length === 0 ? (
                        <p className="py-1 text-[11px] text-faint">No files left in this chat.</p>
                      ) : (
                        <ul className="space-y-0.5">
                          {files.map((d) => (
                            <li key={d.id}>
                              <button onClick={() => window.open(`/dataset/${encodeURIComponent(d.id)}`, "_blank", "noopener")} title="Open the data in a new tab"
                                className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-muted hover:bg-ink/10 hover:text-fg">
                                <FileSpreadsheet size={11} className="shrink-0 text-accent2" />
                                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                                <span className="shrink-0 text-faint">{d.rows?.toLocaleString()} rows</span>
                                <ExternalLink size={10} className="shrink-0 text-faint group-hover:text-accent" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
        <ShieldCheck size={14} /> Read-only secured
      </div>
    </aside>
  );
}
