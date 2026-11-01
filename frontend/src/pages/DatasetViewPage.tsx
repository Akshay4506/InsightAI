/** Data viewer (opened in its own browser tab): the uploaded file's tables, first 500 rows each. */
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import Navbar from "../components/Navbar";
import { fmtNum } from "../lib/utils";

type Preview = Awaited<ReturnType<typeof api.preview>>;

export default function DatasetViewPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (table?: string) => {
    setLoading(true);
    api.preview(id, table).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (data) document.title = `${data.name} - InsightAI`; return () => { document.title = "InsightAI - AI Data Analyst"; }; }, [data]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Navbar />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-8">
        {error ? (
          <p className="m-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : !data ? (
          <div className="m-auto text-faint"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet size={20} className="text-accent2" />
              <h1 className="text-lg font-semibold text-fg">{data.name}</h1>
              <span className="text-sm text-faint">
                {data.total_rows.toLocaleString()} rows{data.total_rows > data.rows.length ? ` (showing first ${data.rows.length.toLocaleString()})` : ""}
              </span>
              {loading && <Loader2 size={15} className="animate-spin text-faint" />}
            </div>

            {data.tables.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {data.tables.map((t) => (
                  <button key={t} onClick={() => load(t)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition ${t === data.table ? "gradient-bg font-semibold text-white" : "glass text-muted hover:text-fg"}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="glass min-h-0 flex-1 overflow-auto rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-card text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2.5 font-medium text-faint">#</th>
                    {data.columns.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} className="border-t border-ink/[0.04] hover:bg-ink/[0.03]">
                      <td className="px-3 py-2 text-xs text-faint tabular-nums">{i + 1}</td>
                      {data.columns.map((c) => (
                        <td key={c} className="whitespace-nowrap px-4 py-2 text-fg tabular-nums">{r[c] == null ? <span className="text-faint">-</span> : fmtNum(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
