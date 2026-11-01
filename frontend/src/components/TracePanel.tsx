/** Right column "Agent Brain": staggered pipeline stepper + security summary. */
import { motion } from "framer-motion";
import { Check, Circle, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { fmtMs } from "../lib/utils";
import { PIPELINE_STEPS, type AskResponse, type StepStatus } from "../types";

function Icon({ status, running }: { status?: StepStatus; running?: boolean }) {
  if (running) return <Loader2 size={14} className="animate-spin text-indigo-300" />;
  if (status === "ok") return <Check size={14} className="text-emerald-400" />;
  if (status === "error" || status === "blocked") return <X size={14} className="text-red-400" />;
  return <Circle size={8} className="text-faint" />;
}

export default function TracePanel({ result, loading }: { result: AskResponse | null; loading: boolean }) {
  const byName = new Map(result?.trace.map((t) => [t.step, t]));
  const blocked = result?.status === "blocked";

  return (
    <aside className="glass flex h-full min-h-0 w-full flex-col overflow-y-auto border-l border-ink/[0.06] p-5 lg:w-full">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${loading ? "animate-ping" : "animate-pulse"}`} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        <h2 className="text-sm font-semibold tracking-wide text-fg">Agent Brain</h2>
        {result && <span className="ml-auto text-xs text-faint">{fmtMs(result.total_ms)} total</span>}
      </div>

      <ol className="relative space-y-1">
        {PIPELINE_STEPS.map((name, i) => {
          const t = byName.get(name);
          const running = loading;
          const failed = t?.status === "error" || t?.status === "blocked";
          return (
            <motion.li key={`${result?.question}-${name}-${loading}`} initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }} transition={{ delay: loading ? 0 : i * 0.1 }}
              className={`rounded-xl border px-3 py-2.5 ${failed ? "border-red-500/30 bg-red-500/10" : "border-ink/[0.05] bg-ink/[0.02]"}`}>
              <div className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 items-center justify-center"><Icon status={t?.status} running={running} /></div>
                <span className={`flex-1 text-sm ${t ? "text-fg" : "text-faint"}`}>{name}</span>
                {t && t.status !== "skipped" && <span className="pill bg-ink/5 text-muted tabular-nums">{fmtMs(t.ms)}</span>}
              </div>
              {t?.detail && <p className={`mt-1.5 pl-7 text-xs leading-snug ${failed ? "text-red-300" : "text-faint"}`}>{t.detail}</p>}
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-faint">Security</h3>
        <div className="space-y-2 text-sm">
          <Row icon={<Lock size={14} />} text="Read-only connection" ok />
          <Row icon={<ShieldCheck size={14} />} text={!result ? "Awaiting query" : blocked ? "Validation failed" : "SQL validated"} ok={!!result && !blocked} bad={blocked} />
        </div>
      </div>
    </aside>
  );
}

function Row({ icon, text, ok, bad }: { icon: React.ReactNode; text: string; ok?: boolean; bad?: boolean }) {
  const tone = bad ? "text-red-300 border-red-500/30 bg-red-500/10" : ok ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/5" : "text-faint border-ink/5";
  return <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${tone}`}>{icon}{text}</div>;
}
