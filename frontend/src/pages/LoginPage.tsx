/** Login with email OR phone number + password; link to signup for first-time users. */
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell, ErrorBanner, Field, onSubmit, SubmitButton } from "../components/AuthShell";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/analyze";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async () => {
    if (!identifier.trim() || !password) return setError("Enter your email or phone number and password");
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to analyse your data.">
      <form onSubmit={onSubmit(submit)} className="space-y-4" noValidate>
        <Field label="Email or phone number" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username" placeholder="you@example.com or +91 98765 43210" autoFocus />
        <div className="relative">
          <Field label="Password" type={show ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}
            className="absolute bottom-2.5 right-3 text-faint hover:text-fg">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <ErrorBanner message={error} />
        <SubmitButton busy={busy}>Log in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        First time here?{" "}
        <Link to="/signup" className="gradient-text font-semibold hover:opacity-80">Create an account</Link>
      </p>
    </AuthShell>
  );
}
