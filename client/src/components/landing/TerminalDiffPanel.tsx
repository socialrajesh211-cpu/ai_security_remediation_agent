import { useEffect, useRef, useState } from "react";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { tint, monoFont } from "../../theme";
import { usePageHidden, usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface FixExample {
  file: string;
  before: string;
  after: string;
}

const EXAMPLES: FixExample[] = [
  {
    file: "package.json",
    before: "axios@0.21.1  (CVE-2021-3749 · ReDoS)",
    after: "axios@1.7.4  — patched, tests pass",
  },
  {
    file: "package.json",
    before: "lodash@4.17.15  (CVE-2020-8203 · prototype pollution)",
    after: "lodash@4.17.21  — patched, tests pass",
  },
  {
    file: "config/loader.py",
    before: "yaml.load(raw_config)  (unsafe deserialization)",
    after: "yaml.safe_load(raw_config)  — patched, tests pass",
  },
  {
    file: "server/middleware.js",
    before: "body-parser@1.19.0  (CVE-2022-24999 · DoS)",
    after: "body-parser@1.20.3  — patched, tests pass",
  },
];

const TYPE_SPEED_MS = 28;
const HOLD_MS = 1400;
const CROSSFADE_MS = 3200; // reduced-motion: time each static example is shown

/**
 * Mock terminal/diff panel that types out a "before" line, holds, types the
 * "after" (patched) line, holds, then erases and moves to the next example.
 * Loops indefinitely.
 *
 * Reduced motion: skips the char-by-char typewriter and rAF-adjacent timers
 * in favor of a slow crossfade between static examples.
 */
export default function TerminalDiffPanel() {
  const { palette } = useTheme();
  const isDark = palette.mode === "dark";
  const prefersReducedMotion = usePrefersReducedMotion();
  const pageHidden = usePageHidden();

  const [index, setIndex] = useState(0);
  const [beforeText, setBeforeText] = useState("");
  const [afterText, setAfterText] = useState("");
  const [phase, setPhase] = useState<"typing-before" | "hold-before" | "typing-after" | "hold-after" | "erasing">(
    "typing-before"
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(pageHidden);
  pausedRef.current = pageHidden;

  // --- Reduced motion: simple crossfade timer, no typewriter state machine ---
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i + 1) % EXAMPLES.length);
    }, CROSSFADE_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  // --- Full motion: typewriter state machine ---
  useEffect(() => {
    if (prefersReducedMotion) return;

    function schedule(fn: () => void, delay: number) {
      timeoutRef.current = setTimeout(() => {
        if (pausedRef.current) {
          // tab is hidden — retry shortly rather than burning through the sequence unseen
          schedule(fn, 300);
          return;
        }
        fn();
      }, delay);
    }

    const current = EXAMPLES[index];

    if (phase === "typing-before") {
      if (beforeText.length < current.before.length) {
        schedule(() => setBeforeText(current.before.slice(0, beforeText.length + 1)), TYPE_SPEED_MS);
      } else {
        schedule(() => setPhase("hold-before"), 300);
      }
    } else if (phase === "hold-before") {
      schedule(() => setPhase("typing-after"), HOLD_MS / 2);
    } else if (phase === "typing-after") {
      if (afterText.length < current.after.length) {
        schedule(() => setAfterText(current.after.slice(0, afterText.length + 1)), TYPE_SPEED_MS);
      } else {
        schedule(() => setPhase("hold-after"), 300);
      }
    } else if (phase === "hold-after") {
      schedule(() => setPhase("erasing"), HOLD_MS);
    } else if (phase === "erasing") {
      schedule(() => {
        setBeforeText("");
        setAfterText("");
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setPhase("typing-before");
      }, 250);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, beforeText, afterText, index, prefersReducedMotion]);

  const current = EXAMPLES[index];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 0,
        overflow: "hidden",
        bgcolor: isDark ? "#081210" : "#0E1E1B",
        borderColor: tint(palette.primary.main, 0.25),
        boxShadow: `0 20px 60px ${tint(palette.primary.main, isDark ? 0.18 : 0.14)}`,
      }}
    >
      {/* title bar */}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{ px: 1.5, py: 1, bgcolor: tint("#000000", 0.25) }}
      >
        {["#FF6159", "#FEBC2E", "#28C840"].map((c) => (
          <Box key={c} sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: c, opacity: 0.85 }} />
        ))}
        <Typography
          variant="caption"
          sx={{ ml: 1, color: "rgba(232,241,238,0.55)", fontFamily: monoFont, fontSize: 12 }}
        >
          sentinel — remediation
        </Typography>
      </Stack>

      <Box sx={{ p: 2.25, minHeight: 132, fontFamily: monoFont, fontSize: 13.5, lineHeight: 1.9 }}>
        {prefersReducedMotion ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <StaticLines file={current.file} before={current.before} after={current.after} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <>
            <Typography sx={{ color: "rgba(232,241,238,0.45)", fontFamily: "inherit", fontSize: "inherit" }}>
              $ sentinel scan {current.file}
            </Typography>
            <Typography sx={{ color: "#FF9B90", fontFamily: "inherit", fontSize: "inherit" }}>
              − {beforeText}
              {phase === "typing-before" && <Cursor />}
            </Typography>
            {(phase === "typing-after" || phase === "hold-after" || phase === "erasing" || afterText) && (
              <Typography sx={{ color: "#7EE0BC", fontFamily: "inherit", fontSize: "inherit" }}>
                + {afterText}
                {phase === "typing-after" && <Cursor />}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

function StaticLines({ file, before, after }: { file: string; before: string; after: string }) {
  return (
    <>
      <Typography sx={{ color: "rgba(232,241,238,0.45)", fontFamily: "inherit", fontSize: "inherit" }}>
        $ sentinel scan {file}
      </Typography>
      <Typography sx={{ color: "#FF9B90", fontFamily: "inherit", fontSize: "inherit" }}>− {before}</Typography>
      <Typography sx={{ color: "#7EE0BC", fontFamily: "inherit", fontSize: "inherit" }}>+ {after}</Typography>
    </>
  );
}

function Cursor() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: "7px",
        height: "1em",
        bgcolor: "currentColor",
        ml: "2px",
        verticalAlign: "text-bottom",
        animation: "sentinel-cursor-blink 1s steps(1) infinite",
        "@keyframes sentinel-cursor-blink": {
          "0%, 49%": { opacity: 1 },
          "50%, 100%": { opacity: 0 },
        },
      }}
    />
  );
}
