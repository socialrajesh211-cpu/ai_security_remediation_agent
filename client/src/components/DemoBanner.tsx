import { Box, Typography, Chip, useTheme } from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import { tint } from "../theme";
import { useAuth } from "../context/AuthContext";

/**
 * Persistent strip shown whenever the session is a demo (Google-login)
 * session, so it's always clear the user is looking at a shared repo rather
 * than their own. Rendered from AppShell, not per-page, so it can't be
 * missed on any authenticated route.
 */
export default function DemoBanner() {
  const { isDemo, demoRepo } = useAuth();
  const { palette } = useTheme();

  if (!isDemo) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        py: 0.75,
        px: 2,
        bgcolor: tint(palette.warning.main, 0.14),
        borderBottom: 1,
        borderColor: tint(palette.warning.main, 0.3),
        flexWrap: "wrap",
      }}
    >
      <Chip
        icon={<ScienceIcon sx={{ fontSize: 15 }} />}
        label="DEMO MODE"
        size="small"
        sx={{ bgcolor: tint(palette.warning.main, 0.25), color: "warning.main", fontWeight: 700, letterSpacing: 0.5 }}
      />
      <Typography variant="caption" color="text.secondary">
        You're exploring a shared demo repository{demoRepo ? ` (${demoRepo})` : ""} — no GitHub account connected.
        Changes here are visible to other demo users.
      </Typography>
    </Box>
  );
}
