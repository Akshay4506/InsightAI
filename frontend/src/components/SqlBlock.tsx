/** Collapsible, syntax-highlighted SQL with a copy button. */
import { Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function SqlBlock({ sql, defaultOpen = false, rejected = false }:
  { sql: string; defaultOpen?: boolean; rejected?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(sql).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink/[0.06] bg-[#0d0f17]">
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white">
          <ChevronDown size={14} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
          {rejected ? "Rejected SQL" : "Generated SQL"}
        </button>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white active:scale-95">
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {open && (
        <SyntaxHighlighter language="sql" style={oneDark} wrapLongLines
          customStyle={{ margin: 0, background: "transparent", fontSize: 12.5, padding: "4px 16px 16px" }}>
          {sql}
        </SyntaxHighlighter>
      )}
    </div>
  );
}
