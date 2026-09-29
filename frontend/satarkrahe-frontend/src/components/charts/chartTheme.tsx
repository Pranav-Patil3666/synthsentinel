import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { StyledEngineProvider, ThemeProvider, createTheme } from "@mui/material/styles";
import type {} from "@mui/x-charts/themeAugmentation";

export interface ChartColors {
  accent: string;
  accentSecondary: string;
  accentTertiary: string;
  destructive: string;
  warning: string;
  muted: string;
  border: string;
  foreground: string;
  mutedForeground: string;
}

const ChartColorsContext = createContext<ChartColors | null>(null);
function readToken(name: string, fallback: string): string {
  return typeof document === "undefined" ? fallback : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function ChartThemeBridge({ children }: { children: ReactNode }) {
  const [colors] = useState<ChartColors>(() => ({
    accent: readToken("--color-accent", "#00ff88"),
    accentSecondary: readToken("--color-accent-secondary", "#ff00ff"),
    accentTertiary: readToken("--color-accent-tertiary", "#00d4ff"),
    destructive: readToken("--color-destructive", "#ff3366"),
    warning: readToken("--color-warning", "#ffc857"),
    muted: readToken("--color-muted", "#1c1c2e"),
    border: readToken("--color-border", "#2a2a3a"),
    foreground: readToken("--color-foreground", "#e0e0e0"),
    mutedForeground: readToken("--color-muted-foreground", "#6b7280"),
  }));
  const theme = useMemo(() => createTheme({
    palette: { mode: "dark", primary: { main: colors.accent }, secondary: { main: colors.accentTertiary }, error: { main: colors.destructive }, warning: { main: colors.warning }, background: { default: "transparent", paper: colors.muted }, text: { primary: colors.foreground, secondary: colors.mutedForeground }, divider: colors.border },
    typography: { fontFamily: '"Share Tech Mono", "JetBrains Mono", monospace' },
    shape: { borderRadius: 0 },
    components: {
      MuiChartsAxis: { styleOverrides: { root: { "& .MuiChartsAxis-tickLabel": { fill: colors.mutedForeground, fontFamily: '"Share Tech Mono", monospace', letterSpacing: "0.1em", fontSize: 10 }, "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: colors.border } } } },
      MuiChartsGrid: { styleOverrides: { line: { stroke: colors.border, strokeOpacity: 0.4 } } },
      MuiChartsTooltip: { styleOverrides: { paper: { backgroundColor: colors.muted, border: `1px solid ${colors.border}`, color: colors.foreground, fontFamily: '"JetBrains Mono", monospace' } } },
    },
  }), [colors]);
  return <StyledEngineProvider injectFirst><ThemeProvider theme={theme}><ChartColorsContext.Provider value={colors}>{children}</ChartColorsContext.Provider></ThemeProvider></StyledEngineProvider>;
}

export function ChartThemeProvider({ children }: { children: ReactNode }) {
  return <ChartThemeBridge>{children}</ChartThemeBridge>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChartColors(): ChartColors {
  const colors = useContext(ChartColorsContext);
  if (!colors) throw new Error("useChartColors must be used inside ChartThemeProvider");
  return colors;
}
