/** Small icon button that copies text to the clipboard and briefly shows a check mark. */
import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (insecure context / permissions): fall back to a hidden textarea.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export default function CopyButton({ text, label = "Copy", size = 14, className = "" }: {
  text: string | (() => string); label?: string; size?: number; className?: string;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<number>();

  const click = async () => {
    if (await copyText(typeof text === "function" ? text() : text)) {
      setDone(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 1600);
    }
  };

  return (
    <button onClick={click} aria-label={done ? "Copied" : label} title={done ? "Copied!" : label}
      className={`rounded-md p-1.5 text-faint transition hover:bg-ink/10 hover:text-fg ${done ? "!text-emerald-400" : ""} ${className}`}>
      {done ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}
