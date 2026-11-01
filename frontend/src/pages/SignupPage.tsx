/** Sign up: name, email, phone, password (min 8), confirm password. */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell, ErrorBanner, Field, onSubmit, SubmitButton } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirm_password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/analyze" replace />;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const validate = (): string | null => {
    if (f.name.trim().length < 2) return "Please enter your full name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return "Enter a valid email address";
    const digits = f.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return "Enter a valid phone number";
    if (f.password.length < 8) return "Password must be at least 8 characters";
    if (f.password !== f.confirm_password) return "Passwords do not match";
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await signup(f);
      navigate("/analyze", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Upload your data and start asking questions.">
      <form onSubmit={onSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Full name" value={f.name} onChange={set("name")} autoComplete="name" placeholder="Ada Lovelace" autoFocus />
        <Field label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="you@example.com" />
        <Field label="Phone number" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" placeholder="+91 98765 43210" />
        <Field label="Password" type="password" value={f.password} onChange={set("password")} autoComplete="new-password"
          placeholder="At least 8 characters" hint="Minimum 8 characters" />
        <Field label="Confirm password" type="password" value={f.confirm_password} onChange={set("confirm_password")}
          autoComplete="new-password" placeholder="Repeat your password" />
        <ErrorBanner message={error} />
        <SubmitButton busy={busy}>Sign up</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="gradient-text font-semibold hover:opacity-80">Log in</Link>
      </p>
    </AuthShell>
  );
}
