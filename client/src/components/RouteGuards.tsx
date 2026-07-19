import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../context/AuthContext";

function CheckingSplash() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

/**
 * The landing page is ONLY reachable if the user has not logged in via GitHub yet.
 * Once authenticated, "/" bounces straight to the dashboard.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "checking") return <CheckingSplash />;
  if (status === "authenticated") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * Dashboard / finding workflow require a verified GitHub session.
 * Anyone not logged in is sent back to the landing page.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "checking") return <CheckingSplash />;
  if (status === "unauthenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
