/** Schema explorer dropdown in the dataset bar: tables of the dataset(s) in use, grouped by file when several. */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Database, FileSpreadsheet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { SchemaTable } from "../types";

interface Group { id: string; name: string; tables: SchemaTable[] }

export default function SchemaDropdown({ datasets, disabled }: { datasets: { id: string; name: string }[]; disabled?: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const key = datasets.map((d) => d.id).join(",");

  useEffect(() => {
    setTable(null);
    setOpen(false);
    let stale = false;
    Promise.all(datasets.map((d) =>
      api.schema(d.id).then((s) => ({ id: d.id, name: d.name, tables: s.tables })).catch(() => ({ id: d.id, name: d.name, tables: [] }))))
      .then((g) => { if (!stale) setGroups(g); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative w-full min-w-0 max-w-[13rem]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={disabled}
        title={disabled ? "Wait for the current answer to finish" : undefined}
        className="glass lift flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-fg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
        <Database size={15} className="shrink-0 text-accent" />
        <span className="truncate">Schema Explorer</span>
        <ChevronDown size={14} className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div style={{ x: "-50%" }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute left-1/2 top-full z-30 mt-2 max-h-80 w-72 max-w-[85vw] overflow-y-auto rounded-xl border border-ink/10 bg-card p-2 shadow-2xl">
            {groups.map((g) => (
              <div key={g.id} className="mb-1">
                <p className="flex items-center gap-1.5 truncate px-2 py-1 text-[11px] font-medium text-muted" title={g.name}>
                  <FileSpreadsheet size={11} className="shrink-0 text-accent2" /> <span className="truncate">{g.name}</span>
                </p>
                {g.tables.length === 0 && <p className="px-2 py-1 text-xs text-faint">No tables.</p>}
                {g.tables.map((t) => {
                  const k = `${g.id}:${t.table}`;
                  return (
                    <div key={k}>
                      <button onClick={() => setTable(table === k ? null : k)}
                        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-fg hover:bg-ink/5">
                        <ChevronRight size={13} className={`transition-transform ${table === k ? "rotate-90" : ""}`} />
                        <span className="truncate">{t.table}</span>
                        <span className="ml-auto text-[10px] text-faint">{t.columns.length}</span>
                      </button>
                      {table === k && (
                        <ul className="mb-1 ml-5 border-l border-ink/10 pl-3">
                          {t.columns.map((c) => (
                            <li key={c.name} className="flex justify-between gap-2 py-0.5 font-mono text-[11px] text-muted">
                              <span className="truncate">{c.name}</span>
                              <span className="shrink-0 text-faint">{c.type.toLowerCase()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
