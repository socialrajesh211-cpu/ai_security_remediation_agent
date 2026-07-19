import { Box, Button, Paper, Stack, Typography, useTheme } from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { motion, useReducedMotion } from "framer-motion";
import { tint } from "../../theme";

const points = [
  "Quick sign-up with just your email, no GitHub connection needed",
  "Runs against a real, pre-configured demo repository on our backend",
  "Watch the AI detect, analyze, and propose a fix in real time",
  "Shared sandbox visible to other demo users, never touches your own code",
];

interface TryDemoSectionProps {
  onTryDemo: () => void;
}

/**
 * Standalone section (as opposed to the small hero button alone) that
 * explains what happens when someone clicks "Try Demo", since that's a
 * meaningfully different, lower-commitment path than "Continue with
 * GitHub" and deserves its own explanation rather than a single
 * unexplained outlined button in the hero.
 */
export default function TryDemoSection({ onTryDemo }: TryDemoSectionProps) {
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box
      component={motion.div}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      sx={{ mt: { xs: 8, md: 10 } }}
    >
      <Paper
        variant="outlined"
        sx={{
          position: "relative",
          overflow: "hidden",
          p: { xs: 3, md: 5 },
          borderRadius: 3,
          borderColor: tint(palette.secondary.main, 0.3),
          bgcolor: isDark ? tint(palette.secondary.main, 0.06) : tint(palette.secondary.main, 0.04),
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          gap: { xs: 3, md: 5 },
        }}
      >
        {/* ambient glow accent */}
        <Box
          sx={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${tint(palette.secondary.main, 0.25)}, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        <Box sx={{ flex: 1, position: "relative" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: tint(palette.secondary.main, 0.16),
                color: "secondary.main",
              }}
            >
              <ScienceIcon />
            </Box>
            <Typography variant="h5" fontWeight={800}>
              Not ready to connect your own GitHub repo?
            </Typography>
          </Stack>

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mb: 2.5 }}>
            Try Demo signs you in with your email and drops you into a real, pre-configured
            repository we host on our backend, so you can watch the full
            detect&nbsp;→&nbsp;analyze&nbsp;→&nbsp;remediate&nbsp;→&nbsp;ship pipeline run against
            actual code, without connecting your own GitHub account.
          </Typography>

          <Stack spacing={1} sx={{ mb: { xs: 3, md: 0 } }}>
            {points.map((point) => (
              <Stack key={point} direction="row" spacing={1.25} alignItems="flex-start">
                <CheckCircleRoundedIcon sx={{ fontSize: 18, mt: "2px", color: "secondary.main" }} />
                <Typography variant="body2" color="text.secondary">
                  {point}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Stack
          spacing={1.5}
          alignItems="center"
          sx={{ position: "relative", flexShrink: 0, width: { xs: "100%", md: "auto" } }}
        >
          <Button
            size="large"
            variant="contained"
            color="secondary"
            startIcon={<ScienceIcon />}
            endIcon={<ArrowForwardIcon />}
            onClick={onTryDemo}
            sx={{ px: 4, py: 1.4, fontSize: 16, width: { xs: "100%", md: "auto" } }}
          >
            Try Demo
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Takes under a minute, just your email, no GitHub required.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
