/** Redirects anonymous visitors to /login (remembering where they wanted to go). */
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
