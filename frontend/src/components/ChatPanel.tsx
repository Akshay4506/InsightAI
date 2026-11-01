/** Center column: empty-state hero, message list, loading skeleton and the input box. */
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Message } from "../types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: Message[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: (q: string) => void;
  onStop: () => void;
  onEdit: (index: number, text: string) => void;
  suggestions: string[];
  datasetName: string;
  readOnly?: boolean;
}

function Skeleton() {
  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="gradient-bg h-2 w-2 animate-dot rounded-full" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
        Thinking...
      </div>
      {["h-40", "h-20", "h-10"].map((cls, i) => (
        <div key={i} className={`relative overflow-hidden rounded-xl bg-ink/[0.04] ${cls}`}>
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-ink/[0.06] to-transparent" />
        </div>
      ))}
    </div>
  );
}

export default function ChatPanel({ messages, loading, input, setInput, onSend, onStop, onEdit, suggestions, datasetName, readOnly }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const canSend = !!input.trim() && !loading && !readOnly;
  const send = () => { if (canSend) { onSend(input); setInput(""); } };

  /** Picking a suggestion fills the box, so put the cursor there: Enter then sends it. */
  const pick = (q: string) => {
    setInput(q);
    requestAnimationFrame(() => { const el = boxRef.current; if (el && !el.disabled) { el.focus(); el.setSelectionRange(q.length, q.length); } });
  };

  // Back in the box once an answer arrives (the box is disabled, so it loses focus, while generating).
  useEffect(() => {
    if (!loading && !readOnly && (document.activeElement === document.body || document.activeElement === null)) boxRef.current?.focus();
  }, [loading, readOnly]);

  // Enter sends whenever the send button is enabled, even if focus is not in the box (e.g. after clicking blank space).
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, button, a, [contenteditable=true]") || t.closest("[role=dialog]"))) return;
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      sendRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && !loading ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <h1 className="gradient-text text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">Ask your data anything.</h1>
            <p className="mt-4 text-muted">Chatting on <span className="font-semibold text-fg">{datasetName}</span>. Powered by RAG + LLM + secure SQL execution.</p>
            <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
              {!readOnly && suggestions.map((s, i) => (
                <motion.button key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i + 0.2 }}
                  onClick={() => onSend(s)}
                  className="glass lift rounded-2xl px-4 py-3.5 text-left text-sm text-fg active:scale-[0.98]">
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => <MessageBubble key={m.id} message={m} onPick={pick} fallback={suggestions} onEdit={(t) => onEdit(i, t)} busy={loading} />)}
            </AnimatePresence>
            {loading && <Skeleton />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-ink/[0.06] bg-bg/60 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="glass mx-auto flex max-w-3xl items-center gap-2 rounded-2xl p-2 focus-within:border-accent/50">
          <textarea ref={boxRef} value={input} rows={2} disabled={loading || readOnly} placeholder={readOnly ? "This file was removed - start a new analysis to continue" : "Ask a question about your data..."}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-40 min-h-[64px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-fg outline-none placeholder:text-faint disabled:opacity-60" />
          {loading ? (
            <button onClick={onStop} aria-label="Stop generating" title="Stop generating"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fg text-bg shadow-lg transition hover:opacity-85 active:scale-90">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button onClick={send} disabled={!canSend} aria-label="Send" title="Send"
              className="gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-90 disabled:opacity-40">
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
