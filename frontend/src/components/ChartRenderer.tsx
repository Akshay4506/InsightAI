/** Renders the recommended chart (bar/line/pie/scatter/kpi) with the accent palette. */
import { useId } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "../context/ThemeContext";
import { PALETTE, fmtNum, humanize } from "../lib/utils";
import type { AskResponse } from "../types";

const axis = { stroke: "#64748b", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipFor = (light: boolean) => ({
  contentStyle: { background: light ? "#ffffff" : "#14141e", border: `1px solid ${light ? "rgba(15,23,42,.12)" : "rgba(255,255,255,.1)"}`, borderRadius: 12, fontSize: 12, color: light ? "#1e293b" : "#e2e8f0" },
  labelStyle: { color: light ? "#475569" : "#cbd5e1" }, itemStyle: { color: light ? "#1e293b" : "#e2e8f0" },
  cursor: { fill: light ? "rgba(15,23,42,.05)" : "rgba(255,255,255,.04)" },
});

export default function ChartRenderer({ result }: { result: AskResponse }) {
  const gid = useId().replace(/:/g, "");
  const light = useTheme().theme === "light";
  const tooltipStyle = tooltipFor(light);
  const grid = light ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.05)";
  const { chart, data } = result;
  const x = chart.x ?? "";
  const y = chart.y ?? "";
  if (chart.type === "table" || !data.length) return null;

  if (chart.type === "kpi") {
    const row = data[0];
    return (
      <div className="relative overflow-hidden rounded-xl border border-ink/[0.06] bg-gradient-to-br from-accent/10 to-accent2/10 px-6 py-8 text-center">
        <div className="text-xs uppercase tracking-widest text-muted">{humanize(y)}{x && row[x] ? ` - ${row[x]}` : ""}</div>
        <div className="gradient-text mt-2 text-5xl font-extrabold tabular-nums">{fmtNum(row[y])}</div>
      </div>
    );
  }

  const body = (() => {
    switch (chart.type) {
      case "bar":
        return (
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey={x} {...axis} interval={0} tickFormatter={(v) => String(v).length > 12 ? `${String(v).slice(0, 11)}...` : v} />
            <YAxis {...axis} tickFormatter={fmtNum} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtNum(v)} />
            <Bar dataKey={y} fill={`url(#${gid})`} radius={[8, 8, 0, 0]} maxBarSize={56} animationDuration={900} />
          </BarChart>
        );
      case "line":
        return (
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.45} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis dataKey={x} {...axis} />
            <YAxis {...axis} tickFormatter={fmtNum} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtNum(v)} />
            <Area type="monotone" dataKey={y} stroke="#8b5cf6" strokeWidth={2.5} fill={`url(#${gid})`}
              dot={{ r: 3, fill: "#a855f7", strokeWidth: 0 }} animationDuration={900} />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie data={data} dataKey={y} nameKey={x} innerRadius="55%" outerRadius="82%" paddingAngle={3} stroke="none" animationDuration={900}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v: number) => fmtNum(v)} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={grid} />
            <XAxis dataKey={x} name={humanize(x)} type="number" {...axis} />
            <YAxis dataKey={y} name={humanize(y)} type="number" {...axis} />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#a855f7" />
          </ScatterChart>
        );
    }
  })();

  return (
    <div className="rounded-xl border border-ink/[0.06] bg-ink/[0.03] p-4">
      <div className="mb-2 text-xs font-medium text-muted">{humanize(y)} by {humanize(x)}</div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">{body!}</ResponsiveContainer>
      </div>
    </div>
  );
}
