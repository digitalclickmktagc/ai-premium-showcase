import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useApp } from "../store/AppProvider";

/** Gate for admin-only routes. Redirects to the login page when unauthenticated. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useApp();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/app/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
