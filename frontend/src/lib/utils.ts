/** Small formatting helpers + shared chart palette. */
export const PALETTE = ["#6366f1", "#a855f7", "#22d3ee", "#34d399", "#f59e0b", "#f472b6", "#60a5fa", "#fb7185"];

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function fmtNum(v: unknown): string {
  if (typeof v !== "number") return v == null ? "-" : String(v);
  return Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(Math.round(v * 100) / 100);
}

export function humanize(col: string): string {
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
