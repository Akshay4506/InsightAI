/** Light/dark switch button (icon shows the mode you will switch to). */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 text-muted transition hover:bg-ink/10 hover:text-fg active:scale-90">
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
