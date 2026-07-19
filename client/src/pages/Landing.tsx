import { Box, Button, Container, Stack, Typography, Grid, Chip, useTheme } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import ScienceIcon from "@mui/icons-material/Science";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ShieldIcon from "@mui/icons-material/Shield";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { tint } from "../theme";
import ScanNetworkBackground from "../components/landing/ScanNetworkBackground";
import ShimmerText from "../components/landing/ShimmerText";
import TerminalDiffPanel from "../components/landing/TerminalDiffPanel";
import PipelineStepCard from "../components/landing/PipelineStepCard";
import PipelineRail from "../components/landing/PipelineRail";
import TryDemoSection from "../components/landing/TryDemoSection";

const steps = [
  {
    icon: <ShieldIcon />,
    title: "Detect",
    body: "Continuously scans your codebase for vulnerable dependencies and insecure code, with no exports and no manual uploads.",
  },
  {
    icon: <AutoAwesomeIcon />,
    title: "Analyze",
    body: "AI explains what's wrong, how it could be exploited, and what it means for the business, all in plain language.",
  },
  {
    icon: <BuildCircleIcon />,
    title: "Remediate",
    body: "Generates a secure code fix, with a clear explanation of why it works.",
  },
  {
    icon: <RocketLaunchIcon />,
    title: "Ship",
    body: "Delivers a ready-to-review fix your team can approve and merge in minutes.",
  },
];

// Shared entrance stagger for the hero: badge -> headline -> subtext -> CTA,
// each offset ~150ms.
const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function Landing() {
  const { loginWithGitHub, loginWithDemo } = useAuth();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get("error");
  const oauthFailed = oauthError === "github_oauth_failed";
  const demoOauthFailed = oauthError === "demo_oauth_failed" || oauthError === "demo_oauth_missing_code";
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          `radial-gradient(1200px 600px at 15% -10%, ${tint(palette.primary.main, isDark ? 0.2 : 0.12)}, transparent 60%),` +
          `radial-gradient(900px 500px at 110% 10%, ${tint(palette.secondary.main, isDark ? 0.16 : 0.1)}, transparent 55%),` +
          palette.background.default,
      }}
    >
      {/* subtle grid texture */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            `linear-gradient(${tint(palette.text.primary, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${tint(palette.text.primary, 0.035)} 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ambient scanning particle network, sits behind hero content */}
      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: { xs: 520, md: 620 } }}>
        <ScanNetworkBackground />
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", pt: { xs: 9, md: 13 }, pb: 10 }}>
        <Grid container spacing={5} alignItems="center" mb={7}>
          <Grid item xs={12} md={7}>
            <Stack
              component={motion.div}
              variants={prefersReducedMotion ? undefined : heroContainer}
              initial={prefersReducedMotion ? false : "hidden"}
              animate={prefersReducedMotion ? undefined : "visible"}
              spacing={2.5}
              textAlign={{ xs: "center", md: "left" }}
              alignItems={{ xs: "center", md: "flex-start" }}
            >
              <Box component={motion.div} variants={prefersReducedMotion ? undefined : heroItem}>
                <Chip
                  icon={<ShieldIcon sx={{ fontSize: 16 }} />}
                  label="AUTOMATED SECURITY REMEDIATION"
                  size="small"
                  sx={{
                    bgcolor: tint(palette.primary.main, 0.12),
                    color: "primary.main",
                    fontWeight: 700,
                    letterSpacing: 1,
                    px: 1,
                  }}
                />
              </Box>

              <Box component={motion.div} variants={prefersReducedMotion ? undefined : heroItem} sx={{ maxWidth: 720 }}>
                <Typography
                  variant="h2"
                  fontWeight={800}
                  sx={{
                    fontSize: { xs: 34, sm: 44, md: 52 },
                    lineHeight: 1.12,
                    letterSpacing: -1,
                  }}
                >
                  Find vulnerabilities. <ShimmerText>Fix them automatically.</ShimmerText>
                </Typography>
              </Box>

              <Box component={motion.div} variants={prefersReducedMotion ? undefined : heroItem} sx={{ maxWidth: 560 }}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: 17 }}>
                  Connect your repository and let AI detect security issues, explain the risk in plain
                  language, and ship a tested fix your team can simply review and approve.
                </Typography>
              </Box>

              <Stack
                component={motion.div}
                variants={prefersReducedMotion ? undefined : heroItem}
                spacing={1.5}
                alignItems={{ xs: "center", md: "flex-start" }}
                pt={1}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems="center"
                >
                  <Box
                    component={motion.div}
                    animate={
                      prefersReducedMotion
                        ? undefined
                        : {
                            boxShadow: [
                              `0 8px 24px ${tint(palette.primary.main, 0.28)}`,
                              `0 8px 32px ${tint(palette.primary.main, 0.5)}`,
                              `0 8px 24px ${tint(palette.primary.main, 0.28)}`,
                            ],
                          }
                    }
                    transition={prefersReducedMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                    whileHover={{ y: -2 }}
                    sx={{ borderRadius: 2, display: "inline-block" }}
                  >
                    <Button
                      size="large"
                      variant="contained"
                      startIcon={<GitHubIcon />}
                      onClick={loginWithGitHub}
                      sx={{
                        px: 4,
                        py: 1.4,
                        fontSize: 16,
                      }}
                    >
                      Continue with GitHub
                    </Button>
                  </Box>
                  <Box component={motion.div} whileHover={{ y: -2 }} sx={{ borderRadius: 2, display: "inline-block" }}>
                    <Button
                      size="large"
                      variant="outlined"
                      color="primary"
                      startIcon={<ScienceIcon />}
                      onClick={() => document.getElementById("try-demo")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      sx={{
                        px: 4,
                        py: 1.4,
                        fontSize: 16,
                        borderWidth: 1.5,
                        borderColor: tint(palette.primary.main, 0.45),
                        bgcolor: tint(palette.primary.main, isDark ? 0.08 : 0.05),
                        "&:hover": {
                          borderWidth: 1.5,
                          borderColor: "primary.main",
                          bgcolor: tint(palette.primary.main, isDark ? 0.14 : 0.09),
                        },
                      }}
                    >
                      Try Demo
                    </Button>
                  </Box>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  We only read your scan results and never ship a change without your approval.
                </Typography>
                {oauthFailed && (
                  <Typography variant="caption" color="error.main">
                    GitHub sign-in didn't go through. Please try again.
                  </Typography>
                )}
                {demoOauthFailed && (
                  <Typography variant="caption" color="error.main">
                    Demo sign-in didn't go through. Please try again.
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Box
              component={motion.div}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            >
              <TerminalDiffPanel />
            </Box>
          </Grid>
        </Grid>

        <Box>
          <PipelineRail steps={steps} />
          <Grid container spacing={2}>
            {steps.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={step.title}>
                <PipelineStepCard icon={step.icon} title={step.title} body={step.body} index={i} />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box id="try-demo">
          <TryDemoSection onTryDemo={loginWithDemo} />
        </Box>
      </Container>
    </Box>
  );
}
