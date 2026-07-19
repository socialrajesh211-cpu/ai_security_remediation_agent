import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { PaletteMode } from "@mui/material";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { buildTheme } from "../theme";

const STORAGE_KEY = "theme_mode";

interface ThemeModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

function readInitialMode(): PaletteMode {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark"; // this app defaults to the dark, IDE-like look
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(readInitialMode);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      toggleMode: () =>
        setMode((prev) => {
          const next = prev === "dark" ? "light" : "dark";
          window.localStorage.setItem(STORAGE_KEY, next);
          return next;
        }),
    }),
    [mode]
  );

  const muiTheme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within a ThemeModeProvider");
  return ctx;
}
