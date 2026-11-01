/** Shared layout for login / signup: minimal navbar + centred glass card. */
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import Navbar from "./Navbar";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Navbar minimal />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="glass w-full max-w-md rounded-3xl p-7 md:p-9">
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">{title}</h1>
          <p className="mb-6 mt-1.5 text-sm text-muted">{subtitle}</p>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input className="field" {...props} />
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{message}</div>;
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={busy}
      className="gradient-bg flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
      {busy && <Loader2 size={16} className="animate-spin" />} {children}
    </button>
  );
}

export const onSubmit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); fn(); };
