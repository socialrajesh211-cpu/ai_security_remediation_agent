import { ReactNode } from "react";
import { Box, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { tint } from "../../theme";

interface ShimmerTextProps {
  children: ReactNode;
  component?: "span";
}

/**
 * A slow gradient sweep across text — not a color change. The gradient
 * itself is built from theme primary/secondary tokens so it tracks
 * light/dark mode automatically.
 */
export default function ShimmerText({ children }: ShimmerTextProps) {
  const { palette } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const gradient = `linear-gradient(90deg, ${palette.primary.main} 0%, ${tint(
    palette.secondary.main,
    1
  )} 25%, ${palette.primary.main} 50%, ${tint(palette.secondary.main, 1)} 75%, ${palette.primary.main} 100%)`;

  if (prefersReducedMotion) {
    // Static fallback: same color the span always had, no animated gradient.
    return (
      <Box component="span" sx={{ color: "primary.main" }}>
        {children}
      </Box>
    );
  }

  return (
    <Box
      component={motion.span}
      animate={{ backgroundPositionX: ["0%", "200%"] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      sx={{
        backgroundImage: gradient,
        backgroundSize: "200% 100%",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        display: "inline",
      }}
    >
      {children}
    </Box>
  );
}
