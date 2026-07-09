import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Appearance } from "react-native";
import {
  Theme,
  ResolvedTheme,
  colors,
  loadTheme,
  saveTheme,
  getSystemTheme,
} from "../lib/theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  colors: typeof colors.light;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTheme().then((stored) => {
      if (stored) {
        setThemeState(stored);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveTheme(theme);
  }, [theme, loaded]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const stored = loadTheme();
      stored.then((s) => {
        if (!s || s === "system") {
          setThemeState(s || "system");
        }
      });
    });
    return () => subscription.remove();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const resolved = resolveTheme(prev);
      return resolved === "dark" ? "light" : "dark";
    });
  }, []);

  const resolved = resolveTheme(theme);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme: resolved,
    setTheme,
    toggleTheme,
    colors: colors[resolved],
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
