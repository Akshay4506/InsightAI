/** Header control: pick one dataset, or "Multiple data" (check 2+ files to analyse them together). */
import { Check, ChevronDown, Eye, FileSpreadsheet, Layers, Pencil, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dataset } from "../types";

interface Props {
  datasets: Dataset[];
  activeId: string;
  multi: boolean;
  multiIds: string[];
  label?: string;
  onSelect: (id: string) => void;
  onSelectMulti: (ids?: string[]) => void;
  onUpload: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
  disabled?: boolean;
}

export default function DatasetPicker({ datasets, activeId, multi, multiIds, label, onSelect, onSelectMulti, onUpload, onDelete, onRename, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = datasets.find((d) => d.id === activeId);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (!open) setEditing(null); }, [open]);

  const saveName = async (d: Dataset) => {
    const dot = d.name.lastIndexOf(".");
    const ext = dot > 0 ? d.name.slice(dot) : "";
    if (!draft.trim()) { setErr("Name cannot be empty"); return; }
    if (draft.trim() + ext === d.name) { setEditing(null); return; }
    setBusy(true);
    try { await onRename(d.id, draft.trim()); setEditing(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not rename"); }
    finally { setBusy(false); }
  };

  const toggle = (id: string) => {
    const next = multiIds.includes(id) ? multiIds.filter((x) => x !== id) : [...multiIds, id].slice(0, 6);
    if (next.length >= 2) onSelectMulti(next);
  };
  const canMulti = datasets.length >= 2;
  const text = label ?? (multi ? `Multiple data (${multiIds.length})` : active?.name ?? "Select dataset");
  const Current = multi ? Layers : FileSpreadsheet;

  return (
    <div ref={ref} className="relative w-full min-w-0 max-w-[13rem] justify-self-start">
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" disabled={disabled}
        title={disabled ? "Wait for the current answer to finish" : undefined}
        className="glass lift flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-fg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
        <Current size={15} className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate text-left font-medium">{text}</span>
        <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="listbox" className="glass !bg-card absolute left-0 top-full z-40 mt-2 w-[26rem] max-w-[92vw] rounded-2xl p-1.5 shadow-2xl">
          <div className="max-h-72 overflow-y-auto">
            {datasets.map((d) => {
              const dot = d.name.lastIndexOf(".");
              const ext = dot > 0 ? d.name.slice(dot) : "";
              const isEditing = editing === d.id;
              return (
                <div key={d.id} className={`rounded-lg ${!multi && d.id === activeId ? "bg-accent/15" : "hover:bg-ink/10"}`}>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                        <input autoFocus value={draft} maxLength={80} disabled={busy}
                          onChange={(e) => { setDraft(e.target.value); setErr(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") void saveName(d); if (e.key === "Escape") setEditing(null); }}
                          aria-label="File name"
                          className="field !rounded-lg !px-2.5 !py-1.5 min-w-0 flex-1" />
                        {ext && <span className="shrink-0 text-xs text-faint">{ext}</span>}
                        <button onClick={() => void saveName(d)} disabled={busy} aria-label="Save name" title="Save"
                          className="rounded-md p-1.5 text-emerald-400 transition hover:bg-emerald-500/15 disabled:opacity-50"><Check size={15} /></button>
                        <button onClick={() => setEditing(null)} disabled={busy} aria-label="Cancel" title="Cancel"
                          className="rounded-md p-1.5 text-faint transition hover:bg-ink/10 hover:text-fg"><X size={15} /></button>
                      </div>
                    ) : (
                      <>
                        <button role="option" aria-selected={!multi && d.id === activeId} onClick={() => { onSelect(d.id); setOpen(false); }}
                          title={d.name} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left">
                          <FileSpreadsheet size={15} className="shrink-0 text-muted" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-fg">{d.name}</span>
                            <span className="block text-[11px] text-faint">{d.rows?.toLocaleString()} rows - {d.tables.length} table{d.tables.length > 1 ? "s" : ""}</span>
                          </span>
                        </button>
                        <button onClick={() => { setEditing(d.id); setDraft(ext ? d.name.slice(0, dot) : d.name); setErr(""); }}
                          aria-label={`Rename ${d.name}`} title="Rename"
                          className="rounded-md p-1.5 text-faint transition hover:bg-accent/15 hover:text-accent"><Pencil size={14} /></button>
                        <button onClick={() => window.open(`/dataset/${encodeURIComponent(d.id)}`, "_blank", "noopener")}
                          aria-label={`View ${d.name}`} title="View data in a new tab"
                          className="rounded-md p-1.5 text-faint transition hover:bg-accent/15 hover:text-accent"><Eye size={14} /></button>
                        <button onClick={() => { if (confirm(`Delete "${d.name}" from this chat? Earlier answers stay.`)) onDelete(d.id); }}
                          aria-label={`Delete ${d.name}`} title="Delete"
                          className="mr-1 rounded-md p-1.5 text-faint transition hover:bg-red-500/15 hover:text-red-400"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                  {isEditing && err && <p className="px-3 pb-1.5 text-xs text-red-400">{err}</p>}
                </div>
              );
            })}
          </div>

          <div className="mt-1.5 border-t border-ink/10 pt-1.5">
            <button disabled={!canMulti} onClick={() => onSelectMulti()}
              title={canMulti ? "Analyse several files together" : "Upload at least two files to use this"}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${multi ? "bg-accent/15" : "enabled:hover:bg-ink/10"}`}>
              <Layers size={15} className="shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">Multiple data</span>
                <span className="block text-[11px] text-faint">{canMulti ? "Analyse and join several files together" : "Upload 2+ files to enable"}</span>
              </span>
            </button>
            {multi && (
              <ul className="mt-1 space-y-0.5 pl-3">
                {datasets.map((d) => {
                  const on = multiIds.includes(d.id);
                  const locked = on && multiIds.length <= 2;
                  return (
                    <li key={d.id}>
                      <button onClick={() => toggle(d.id)} disabled={locked} title={locked ? "Keep at least two files selected" : undefined}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm text-fg enabled:hover:bg-ink/10 disabled:cursor-not-allowed">
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "gradient-bg border-transparent text-white" : "border-ink/30"}`}>
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{d.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button onClick={() => { setOpen(false); onUpload(); }}
            className="gradient-bg mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white active:scale-[0.98]">
            <Upload size={14} /> Upload CSV / Excel
          </button>
        </div>
      )}
    </div>
  );
}
