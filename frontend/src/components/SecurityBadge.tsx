/** Security badge row: read-only / validated / latency, or a red "blocked" banner. */
import { Clock, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { fmtMs } from "../lib/utils";
import type { AskResponse } from "../types";

export default function SecurityBadge({ result }: { result: AskResponse }) {
  if (result.status === "blocked") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">
        <ShieldAlert size={16} /> Query blocked: {result.error}
      </div>
    );
  }
  const Chip = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" }) => (
    <span className={`pill inline-flex items-center gap-1.5 border ${tone === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-ink/10 bg-ink/5 text-fg"}`}>
      {children}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip><Lock size={11} /> Read-only</Chip>
      {result.status === "ok" && <Chip tone="green"><ShieldCheck size={11} /> Validated</Chip>}
      <Chip><Clock size={11} /> {fmtMs(result.total_ms)}</Chip>
    </div>
  );
}
