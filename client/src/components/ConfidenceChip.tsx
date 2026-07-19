import { Chip, Tooltip, useTheme } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { tint } from "../theme";

/**
 * A hoverable chip for the AI's self-reported confidence score. Renders as a
 * plain "Confidence: N%" line reads as an unexplained number, so this makes
 * clear (on hover) what it actually measures.
 */
export default function ConfidenceChip({ value }: { value: number }) {
  const { palette } = useTheme();
  const color = value >= 80 ? palette.success.main : value >= 50 ? palette.warning.main : palette.error.main;
  return (
    <Tooltip
      arrow
      title="How confident the AI is that this result is accurate and complete for this specific finding, based on the code and context it was given. Lower scores mean it's worth double-checking manually before you rely on it."
    >
      <Chip
        size="small"
        icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
        label={`Confidence ${value}%`}
        sx={{
          bgcolor: tint(color, palette.mode === "dark" ? 0.22 : 0.14),
          color,
          fontWeight: 700,
          cursor: "help",
          "& .MuiChip-icon": { color },
        }}
      />
    </Tooltip>
  );
}
