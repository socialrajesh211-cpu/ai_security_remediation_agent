import { createTheme, ThemeOptions, PaletteMode, alpha } from "@mui/material/styles";

/**
 * "Sentinel" theme — a deep-teal signal color (scanning/radar feel, fitting
 * a tool that continuously watches a codebase) paired with a warm copper
 * accent reserved for AI/agent actions, so the two read as distinct
 * languages: teal = the product, copper = "the agent did something".
 * Severity colors are a separate semantic scale (red/orange/amber/blue),
 * tuned per mode so every combination clears WCAG AA against its background.
 */

const fontStack = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';

type ModeTokens = {
  primary: { main: string; light: string; dark: string; contrastText: string };
  secondary: { main: string; light: string; dark: string; contrastText: string };
  background: { default: string; paper: string };
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  error: { main: string; light: string; dark: string };
  warning: { main: string; light: string; dark: string };
  success: { main: string; light: string; dark: string };
  info: { main: string; light: string; dark: string };
  severity: { critical: string; high: string; medium: string; low: string };
  neutralStatus: string;
  gradientText: string;
};

const tokens: Record<PaletteMode, ModeTokens> = {
  light: {
    primary: { main: "#0F6E66", light: "#3F8F87", dark: "#0A4F49", contrastText: "#FFFFFF" },
    secondary: { main: "#A8500E", light: "#C97A3E", dark: "#7C3A08", contrastText: "#FFFFFF" },
    background: { default: "#F4F8F7", paper: "#FFFFFF" },
    text: { primary: "#132420", secondary: "#54655F", disabled: "#94A29D" },
    divider: "#DEE7E3",
    error: { main: "#B3382C", light: "#D4574A", dark: "#8A2A20" },
    warning: { main: "#8A6300", light: "#A9822A", dark: "#644800" },
    success: { main: "#1B7A5C", light: "#3E9678", dark: "#125941" },
    info: { main: "#2E5CA8", light: "#5478BE", dark: "#1F4380" },
    severity: { critical: "#B3382C", high: "#9C5A00", medium: "#7A6100", low: "#33569E" },
    neutralStatus: "#6B7C76",
    gradientText: "#FBFEFD",
  },
  dark: {
    primary: { main: "#4FD1C0", light: "#7FE0D3", dark: "#2BA89A", contrastText: "#07211D" },
    secondary: { main: "#EBA05A", light: "#F2BA84", dark: "#C97D3B", contrastText: "#241203" },
    background: { default: "#0B1615", paper: "#111F1C" },
    text: { primary: "#E8F1EE", secondary: "#9FB6B0", disabled: "#5E726C" },
    divider: "#213330",
    error: { main: "#FF7A6B", light: "#FF9B90", dark: "#D65B4D" },
    warning: { main: "#F0B95E", light: "#F5CD8A", dark: "#C99436" },
    success: { main: "#4FD1A0", light: "#7EE0BC", dark: "#2FA97F" },
    info: { main: "#82A6F2", light: "#A6C0F5", dark: "#5C82D6" },
    severity: { critical: "#FF7A6B", high: "#F0A24E", medium: "#EBCB5C", low: "#82A6F2" },
    neutralStatus: "#7E938D",
    gradientText: "#07201B",
  },
};

const sharedOptions: ThemeOptions = {
  typography: {
    fontFamily: fontStack,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
};

export function buildTheme(mode: PaletteMode) {
  const t = tokens[mode];

  return createTheme({
    ...sharedOptions,
    palette: {
      mode,
      primary: t.primary,
      secondary: t.secondary,
      error: t.error,
      warning: t.warning,
      success: t.success,
      info: t.info,
      background: t.background,
      text: t.text,
      divider: t.divider,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          // Visible, on-brand keyboard focus ring rather than the browser default.
          "*:focus-visible": {
            outline: `2px solid ${t.primary.main}`,
            outlineOffset: "2px",
          },
        },
      },
    },
  });
}

// Default/back-compat export — the original static dark theme.
export const theme = buildTheme("dark");

/** Semantic severity scale, tuned per mode for AA contrast on that mode's surfaces. */
export const severityPalette: Record<PaletteMode, Record<"critical" | "high" | "medium" | "low", string>> = {
  light: tokens.light.severity,
  dark: tokens.dark.severity,
};

export function getSeverityColor(mode: PaletteMode, severity: string): string {
  const scale = severityPalette[mode];
  return (scale as Record<string, string>)[severity] ?? scale.low;
}

/** Muted neutral for "disabled" / "unknown" status chips — a quiet cousin of the brand teal, not a flat gray. */
export function getNeutralStatusColor(mode: PaletteMode): string {
  return tokens[mode].neutralStatus;
}

/** The teal → copper diagonal used for the shield mark and the AI-agent CTA buttons. */
export function brandGradient(mode: PaletteMode): { background: string; color: string } {
  const t = tokens[mode];
  return {
    background: `linear-gradient(135deg, ${t.primary.main} 0%, ${t.secondary.main} 100%)`,
    color: t.gradientText,
  };
}

/** Soft tinted background for a color on a given surface, e.g. chip fills. Replaces ad-hoc `${hex}22` string hacks. */
export function tint(color: string, opacity = 0.16): string {
  return alpha(color, opacity);
}

// Back-compat static export (dark-mode values) for any code not yet migrated to getSeverityColor().
export const severityColor: Record<string, string> = tokens.dark.severity;

export const monoFont = '"JetBrains Mono", "Fira Code", monospace';
