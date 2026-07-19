import { ReactNode } from "react";
import { Box, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { tint } from "../../theme";

interface RailStep {
  icon: ReactNode;
  title: string;
}

interface PipelineRailProps {
  steps: RailStep[];
}

const NODE_SIZE = 34;

/**
 * Stepper-style trail that sits above the four pipeline cards and visually
 * threads them together end-to-end: node -> line -> node -> line ...
 *
 * Every node and every connector segment is the *same fixed height* (a bare
 * circle, a 2px line — no extra labels stacked underneath), so a plain
 * `alignItems: "center"` flex row keeps every line dead-centered on every
 * circle automatically. That was the bug in the previous version: the
 * number label under each node made that node's column taller than the
 * connector segments, which pushed the line's centered position below the
 * circle's actual center.
 */
export default function PipelineRail({ steps }: PipelineRailProps) {
  const { palette } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const isDark = palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 0, sm: 3 },
        mb: { xs: 2, sm: 2.5 },
      }}
    >
      {steps.map((step, i) => (
        <Box
          key={step.title}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            flexGrow: { xs: 0, sm: i === steps.length - 1 ? 0 : 1 },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {/* node */}
          <Box
            component={motion.div}
            initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0 }}
            whileInView={prefersReducedMotion ? undefined : { scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.18, ease: "easeOut" }}
            sx={{
              width: NODE_SIZE,
              height: NODE_SIZE,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: tint(palette.primary.main, isDark ? 0.16 : 0.12),
              color: "primary.main",
              border: "2px solid",
              borderColor: tint(palette.primary.main, 0.4),
              flexShrink: 0,
              "& svg": { fontSize: 17 },
            }}
          >
            {step.icon}
          </Box>

          {/* connector segment to the next node */}
          {i < steps.length - 1 && (
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 4,
                flexGrow: { xs: 0, sm: 1 },
                flexShrink: 0,
                width: { xs: 2, sm: "auto" },
                height: { xs: 28, sm: 2 },
                minWidth: { sm: 24 },
                bgcolor: tint(palette.text.primary, 0.08),
              }}
            >
              <Box
                component={motion.div}
                initial={prefersReducedMotion ? false : { scaleX: 0, scaleY: 0 }}
                whileInView={prefersReducedMotion ? undefined : { scaleX: 1, scaleY: 1 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: 0.25 + i * 0.2, ease: "easeOut" }}
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(${palette.primary.main}, ${palette.primary.main})`,
                  transformOrigin: { xs: "top center", sm: "left center" },
                }}
              />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
