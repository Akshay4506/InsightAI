/** Website icon + name; the whole thing is one link to the home page. */
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Logo() {
  return (
    <Link to="/" aria-label="InsightAI home" className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition active:scale-95">
      <span className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-accent/30">
        <Sparkles size={18} className="text-white" />
      </span>
      <span className="text-lg font-bold tracking-tight text-fg">Insight<span className="gradient-text">AI</span></span>
    </Link>
  );
}
