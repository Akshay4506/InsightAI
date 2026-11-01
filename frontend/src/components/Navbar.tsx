/** Top nav bar. Left: logo. Right: theme toggle, then Login button or profile avatar + dropdown.
 *  `dashboard` (profile page): adds a Dashboard link to the chat workspace left of the theme toggle.
 *  `minimal` (login/signup pages): logo on the left and only the theme toggle on the right. */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg transition hover:bg-ink/10";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex items-center gap-1.5 rounded-xl p-1 pr-2 transition hover:bg-ink/10 active:scale-95">
        <span className="gradient-bg flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md shadow-accent/30">
          {initial}
        </span>
        <ChevronDown size={15} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.12 }}
            className="glass absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl p-1.5 !bg-card shadow-2xl">
            <div className="border-b border-ink/10 px-3 pb-2 pt-1.5">
              <div className="truncate text-sm font-semibold text-fg">{user?.name}</div>
              <div className="truncate text-xs text-faint">{user?.email}</div>
            </div>
            <div className="pt-1.5">
              <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <UserIcon size={15} className="text-muted" /> My Profile
              </Link>
              <button role="menuitem" className={item} onClick={() => { setOpen(false); logout(); navigate("/"); }}>
                <LogOut size={15} className="text-muted" /> Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar({ minimal = false, dashboard = false }: { minimal?: boolean; dashboard?: boolean }) {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-ink/[0.08] bg-bg/70 px-4 backdrop-blur-xl md:px-6">
      <Logo />
      <div className="flex items-center gap-2.5">
        {dashboard && user && (
          <Link to="/analyze" title="Back to your chats"
            className="glass lift flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-fg active:scale-95">
            <LayoutDashboard size={15} className="text-accent" /> Dashboard
          </Link>
        )}
        <ThemeToggle />
        {!minimal && !loading && (user ? <ProfileMenu /> : (
          <Link to="/login"
            className="gradient-bg rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-95">
            Login
          </Link>
        ))}
      </div>
    </header>
  );
}
