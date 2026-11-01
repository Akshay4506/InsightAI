/** Full assistant result: badge, chart, table, SQL, insights, follow-ups (or blocked/error/empty states). */
import { motion } from "framer-motion";
import { AlertTriangle, DatabaseZap } from "lucide-react";
import type { AskResponse } from "../types";
import CopyButton from "./CopyButton";
import ChartRenderer from "./ChartRenderer";
import DataTable from "./DataTable";
import FollowUpChips from "./FollowUpChips";
import InsightCards from "./InsightCards";
import SecurityBadge from "./SecurityBadge";
import SqlBlock from "./SqlBlock";

/** Plain-text version of an answer: the insights, then the table as tab-separated rows (pastes into Excel). */
function answerText(r: AskResponse): string {
  const parts: string[] = [];
  if (r.insights.length) parts.push(r.insights.map((i) => `- ${i}`).join("\n"));
  if (r.data.length) {
    const cols = Object.keys(r.data[0]);
    const rows = r.data.slice(0, 200).map((row) => cols.map((c) => String(row[c] ?? "")).join("\t"));
    parts.push([cols.join("\t"), ...rows].join("\n"));
  }
  return parts.join("\n\n");
}

export default function ResultCard({ result, onPick, fallback = [] }: { result: AskResponse; onPick: (q: string) => void; fallback?: string[] }) {
  const blocked = result.status === "blocked";
  const failed = result.status === "error";
  const empty = result.status === "ok" && result.data.length === 0;
  // A blocked / failed answer has no follow-ups of its own: offer the dataset's starter questions instead.
  const instead = (blocked || failed) && result.followups.length === 0 ? fallback.slice(0, 4) : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }}
      className={`glass space-y-4 rounded-2xl p-5 ${blocked ? "!border-red-500/30" : ""}`}>
      <SecurityBadge result={result} />

      {failed && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <span>{result.error}</span>
        </div>
      )}
      {empty && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.02] py-8 text-center">
          <DatabaseZap className="text-faint" size={28} />
          <div className="font-medium text-fg">No data matched your question</div>
          <div className="text-xs text-faint">Try widening the time range or rephrasing.</div>
        </div>
      )}
      {blocked && (
        <p className="text-sm text-red-200/80">
          The safety validator stopped this request before it reached the database. Only single, read-only SELECT
          statements on approved tables are allowed.
        </p>
      )}

      {!blocked && !failed && <ChartRenderer result={result} />}
      {!blocked && !failed && <DataTable rows={result.data} />}
      {result.truncated && <p className="text-xs text-amber-300/80">Result truncated at 1000 rows.</p>}
      {result.sql && <SqlBlock sql={result.sql} rejected={blocked} defaultOpen={blocked} />}
      {!blocked && !failed && <InsightCards insights={result.insights} />}
      <FollowUpChips items={result.followups} onPick={onPick} />
      {instead.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-faint">Try one of these instead:</p>
          <FollowUpChips items={instead} onPick={onPick} />
        </div>
      )}
      {result.status === "ok" && (result.insights.length > 0 || result.data.length > 0) && (
        <div className="-mb-1 flex justify-end"><CopyButton text={() => answerText(result)} label="Copy answer (insights + table)" /></div>
      )}
    </motion.div>
  );
}
