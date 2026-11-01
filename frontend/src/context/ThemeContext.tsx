/** Light/dark theme state, persisted in localStorage and applied as a class on <html>. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";
const KEY = "insightai-theme";

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) === "light" ? "light" : "dark"));

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
