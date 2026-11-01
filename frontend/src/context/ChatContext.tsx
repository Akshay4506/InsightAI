/** Keeps the chat workspace alive across pages so a running question finishes in the background. */
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useAuth } from "./AuthContext";

type ChatValue = ReturnType<typeof useChat>;
const Ctx = createContext<ChatValue>(null as unknown as ChatValue);

function Inner({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const onUnauthorized = useCallback(() => { logout(); navigate("/login"); }, [logout, navigate]);
  return <Ctx.Provider value={useChat(onUnauthorized, enabled)}>{children}</Ctx.Provider>;
}

/** Remounts per user, so logging out (or switching account) clears all chat state. */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <Inner key={user?.id ?? "anon"} enabled={!!user}>{children}</Inner>;
}

export const useChatContext = () => useContext(Ctx);
