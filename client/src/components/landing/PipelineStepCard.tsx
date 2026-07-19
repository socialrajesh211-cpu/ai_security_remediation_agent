import { ReactNode } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { tint } from "../../theme";

interface PipelineStepCardProps {
  icon: ReactNode;
  title: string;
  body: string;
  index: number;
}

export default function PipelineStepCard({ icon, title, body, index }: PipelineStepCardProps) {
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box
      component={motion.div}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      sx={{ height: "100%" }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          height: "100%",
          bgcolor: isDark ? tint(palette.background.paper, 0.6) : palette.background.paper,
          backdropFilter: "blur(6px)",
          transition: "border-color 0.2s ease",
          "&:hover": { borderColor: "primary.main" },
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            component={motion.div}
            animate={
              prefersReducedMotion
                ? undefined
                : { y: [0, -4, 0] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 2.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.35,
                  }
            }
            whileHover={{ scale: 1.12 }}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: tint(palette.primary.main, 0.12),
              color: "primary.main",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {String(index + 1).padStart(2, "0")}
              </Typography>
              <Typography variant="subtitle1" fontWeight={700}>
                {title}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {body}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
