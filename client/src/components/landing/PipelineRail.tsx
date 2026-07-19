import { Box, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { tint } from "../../theme";

/**
 * Thin rail that visually threads the four pipeline step cards together.
 * Horizontal (spanning the row) at sm+ where the grid is 2 columns wide;
 * vertical (spanning the stack) below sm where cards are a single column.
 * Fills in via a scale transform as it scrolls into view.
 */
export default function PipelineRail() {
  const { palette } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const color = tint(palette.primary.main, 0.5);

  const commonTransition = { duration: 0.9, ease: "easeOut" as const };

  return (
    <>
      {/* horizontal variant, sm and up */}
      <Box
        component={motion.div}
        initial={prefersReducedMotion ? false : { scaleX: 0 }}
        whileInView={prefersReducedMotion ? undefined : { scaleX: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={commonTransition}
        sx={{
          display: { xs: "none", sm: "block" },
          position: "absolute",
          left: "8%",
          right: "8%",
          top: 18,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          transformOrigin: "left center",
          zIndex: 0,
        }}
      />
      {/* vertical variant, below sm */}
      <Box
        component={motion.div}
        initial={prefersReducedMotion ? false : { scaleY: 0 }}
        whileInView={prefersReducedMotion ? undefined : { scaleY: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={commonTransition}
        sx={{
          display: { xs: "block", sm: "none" },
          position: "absolute",
          top: 18,
          bottom: 18,
          left: 35,
          width: 2,
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
          transformOrigin: "top center",
          zIndex: 0,
        }}
      />
    </>
  );
}
