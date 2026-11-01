/** Result table: shows 5 rows by default with a "show all" toggle. */
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { fmtNum, humanize } from "../lib/utils";

export default function DataTable({ rows }: { rows: Record<string, string | number | null>[] }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  const shown = all ? rows : rows.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-xl border border-ink/[0.06]">
      <div className={`overflow-auto ${all ? "max-h-96" : ""}`}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted">
            <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">{humanize(c)}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="border-t border-ink/[0.04] transition-colors hover:bg-ink/[0.03]">
                {cols.map((c) => (
                  <td key={c} className={`whitespace-nowrap px-4 py-2 ${typeof r[c] === "number" ? "tabular-nums text-fg" : "text-fg"}`}>
                    {fmtNum(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 5 && (
        <button onClick={() => setAll(!all)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-ink/[0.04] py-2 text-xs text-muted hover:bg-ink/[0.03] hover:text-fg">
          <ChevronDown size={13} className={all ? "rotate-180" : ""} />
          {all ? "Show fewer" : `Show all ${rows.length} rows`}
        </button>
      )}
    </div>
  );
}
