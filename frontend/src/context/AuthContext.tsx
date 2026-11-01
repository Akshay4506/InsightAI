/** Auth state: current user, login/signup/logout; restores the session from the stored token. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "../api/client";
import type { User } from "../types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (b: Parameters<typeof api.signup>[0]) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.me().then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const r = await api.login(identifier, password);
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const signup = useCallback(async (b: Parameters<typeof api.signup>[0]) => {
    const r = await api.signup(b);
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
