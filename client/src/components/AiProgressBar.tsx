import { useEffect, useState } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { brandGradient, tint } from "../theme";

/**
 * A percentage-driven progress bar for AI calls that don't report real
 * progress from the server. Climbs quickly at first, eases off approaching
 * ~92% while the request is in flight, then snaps to 100% and fades out
 * once `active` goes false — reads as "the agent is thinking", not a
 * generic spinner.
 */
export default function AiProgressBar({ active, label }: { active: boolean; label: string }) {
  const { palette } = useTheme();
  const gradient = brandGradient(palette.mode);
  const [percent, setPercent] = useState(0);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setVisible(true);
      setPercent((p) => (p > 0 ? p : 6));
      const interval = setInterval(() => {
        setPercent((p) => {
          const target = 92;
          if (p >= target) return p;
          const next = p + (target - p) * 0.12 + Math.random() * 1.5;
          return Math.min(next, target);
        });
      }, 220);
      return () => clearInterval(interval);
    }
    if (visible) {
      setPercent(100);
      const timeout = setTimeout(() => {
        setVisible(false);
        setPercent(0);
      }, 500);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!visible) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <AutoAwesomeIcon
            sx={{
              fontSize: 15,
              color: "primary.main",
              animation: "aiPulse 1.4s ease-in-out infinite",
              "@keyframes aiPulse": {
                "0%, 100%": { opacity: 0.55, transform: "scale(0.9)" },
                "50%": { opacity: 1, transform: "scale(1.15)" },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "primary.main", fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" }}
        >
          {Math.round(percent)}%
        </Typography>
      </Stack>

      <Box sx={{ height: 6, borderRadius: 999, bgcolor: tint(palette.primary.main, 0.14), overflow: "hidden" }}>
        <Box
          sx={{
            height: "100%",
            width: `${percent}%`,
            borderRadius: 999,
            background: gradient.background.replace("135deg", "90deg"),
            position: "relative",
            transition: "width .25s ease",
            overflow: "hidden",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              animation: "aiShimmer 1.2s linear infinite",
            },
            "@keyframes aiShimmer": {
              "0%": { transform: "translateX(-100%)" },
              "100%": { transform: "translateX(250%)" },
            },
          }}
        />
      </Box>
    </Box>
  );
}
