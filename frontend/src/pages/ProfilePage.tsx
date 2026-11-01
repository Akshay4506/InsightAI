/** Profile: read-only name/email/phone + change-password form. */
import { motion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { ErrorBanner, Field, onSubmit, SubmitButton } from "../components/AuthShell";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();
  const [f, setF] = useState({ old_password: "", new_password: "", confirm_password: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setDone(false); };

  const submit = async () => {
    setError(null);
    setDone(false);
    if (!f.old_password) return setError("Enter your old password");
    if (f.new_password.length < 8) return setError("New password must be at least 8 characters");
    if (f.new_password !== f.confirm_password) return setError("New passwords do not match");
    setBusy(true);
    try {
      await api.changePassword(f);
      setF({ old_password: "", new_password: "", confirm_password: "" });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <Navbar dashboard />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <span className="gradient-bg flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg shadow-accent/30">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-fg">My Profile</h1>
            <p className="text-sm text-muted">Member since {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
        </motion.div>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass rounded-3xl p-6 md:p-8">
          <h2 className="mb-1 text-lg font-semibold text-fg">Account details</h2>
          <p className="mb-5 flex items-center gap-1.5 text-xs text-faint"><Lock size={12} /> These details can't be edited.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" value={user.name} readOnly disabled />
            <Field label="Mobile number" value={user.phone} readOnly disabled />
            <div className="md:col-span-2"><Field label="Email" value={user.email} readOnly disabled /></div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass rounded-3xl p-6 md:p-8">
          <h2 className="mb-5 text-lg font-semibold text-fg">Change password</h2>
          <form onSubmit={onSubmit(submit)} className="space-y-4" noValidate>
            <Field label="Old password" type="password" value={f.old_password} onChange={set("old_password")} autoComplete="current-password" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="New password" type="password" value={f.new_password} onChange={set("new_password")}
                autoComplete="new-password" hint="Minimum 8 characters" />
              <Field label="Confirm new password" type="password" value={f.confirm_password} onChange={set("confirm_password")} autoComplete="new-password" />
            </div>
            <ErrorBanner message={error} />
            {done && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
                <CheckCircle2 size={16} /> Password updated.
              </div>
            )}
            <div className="max-w-xs"><SubmitButton busy={busy}>Update password</SubmitButton></div>
          </form>
        </motion.section>
      </main>
    </div>
  );
}
