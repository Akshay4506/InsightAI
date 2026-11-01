/** Clickable follow-up question pills; clicking fills the input. */
import { Sparkles } from "lucide-react";

export default function FollowUpChips({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((q) => (
        <button key={q} onClick={() => onPick(q)}
          className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-indigo-200 transition hover:-translate-y-0.5 hover:border-accent2/60 hover:bg-accent2/15 active:scale-95">
          <Sparkles size={12} /> {q}
        </button>
      ))}
    </div>
  );
}
