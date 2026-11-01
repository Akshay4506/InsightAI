/** Chat message: user bubble (copy / edit) or assistant result card. */
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { useState } from "react";
import type { Message } from "../types";
import CopyButton from "./CopyButton";
import ResultCard from "./ResultCard";

interface Props {
  message: Message;
  onPick: (q: string) => void;
  onEdit: (text: string) => void;
  /** Dataset starter questions, offered under a blocked / failed answer that has no suggestions of its own. */
  fallback?: string[];
  /** An answer is being generated: editing is paused. */
  busy?: boolean;
}

export default function MessageBubble({ message, onPick, onEdit, busy, fallback }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (message.role !== "user") return <ResultCard result={message.result} onPick={onPick} fallback={fallback} />;

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setEditing(false);
    if (t !== message.text.trim() || message.stopped) onEdit(t);
  };

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[85%] rounded-2xl border border-accent/40 bg-card p-3 shadow-lg">
          <textarea autoFocus value={draft} rows={Math.min(8, Math.max(2, draft.split("\n").length))} maxLength={1000} aria-label="Edit your question"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === "Escape") setEditing(false);
            }}
            className="field resize-none" />
          <p className="mt-1.5 text-[11px] text-faint">Sending replaces this question and removes the answers after it.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-ink/10 hover:text-fg">Cancel</button>
            <button onClick={submit} disabled={!draft.trim()}
              className="gradient-bg rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">Send</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group flex flex-col items-end gap-1">
      <div className="gradient-bg max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-accent/20">
        {message.text}
      </div>
      {message.stopped && <span className="pr-1 text-xs italic text-faint">Generation stopped</span>}
      <div className="flex items-center gap-0.5 pr-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        <CopyButton text={message.text} label="Copy prompt" />
        {!busy && (
          <button onClick={() => { setDraft(message.text); setEditing(true); }} aria-label="Edit prompt" title={message.stopped ? "Edit and resend" : "Edit prompt"}
            className="rounded-md p-1.5 text-faint transition hover:bg-ink/10 hover:text-fg">
            <Pencil size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
