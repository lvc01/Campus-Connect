import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#111827",
    surface: "#f9fafb",
    surfaceForeground: "#111827",
    textPrimary: "#111827",
    textSecondary: "#6b7280",
    textTertiary: "#9ca3af",
    textInverse: "#ffffff",
    textMuted: "#6b7280",
    accent: "#dc2626",
    accentForeground: "#ffffff",
    accentHover: "#b91c1c",
    accentLight: "#fef2f2",
    success: "#16a34a",
    successLight: "#dcfce7",
    warning: "#eab308",
    warningLight: "#fef9c3",
    error: "#dc2626",
    errorLight: "#fef2f2",
    repost: "#16a34a",
    like: "#ec4899",
    border: "#e5e7eb",
    borderStrong: "#d1d5db",
    borderLight: "#e5e7eb",
    input: "#e5e7eb",
    ring: "#dc2626",
    card: "#ffffff",
    cardForeground: "#111827",
    popover: "#ffffff",
    popoverForeground: "#111827",
    primary: "#dc2626",
    primaryForeground: "#ffffff",
    secondary: "#f9fafb",
    secondaryForeground: "#111827",
    muted: "#f9fafb",
    mutedForeground: "#6b7280",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    backdrop: "rgba(0, 0, 0, 0.40)",
  },
  dark: {
    background: "#000000",
    foreground: "#f3f4f6",
    surface: "#111827",
    surfaceForeground: "#f3f4f6",
    textPrimary: "#f3f4f6",
    textSecondary: "#9ca3af",
    textTertiary: "#6b7280",
    textInverse: "#000000",
    textMuted: "#9ca3af",
    accent: "#f87171",
    accentForeground: "#000000",
    accentHover: "#ef4444",
    accentLight: "#7f1d1d",
    success: "#22c55e",
    successLight: "#14532d",
    warning: "#facc15",
    warningLight: "#713f12",
    error: "#f87171",
    errorLight: "#7f1d1d",
    repost: "#22c55e",
    like: "#f472b6",
    border: "#374151",
    borderStrong: "#4b5563",
    borderLight: "#374151",
    input: "#374151",
    ring: "#f87171",
    card: "#111827",
    cardForeground: "#f3f4f6",
    popover: "#111827",
    popoverForeground: "#f3f4f6",
    primary: "#f87171",
    primaryForeground: "#000000",
    secondary: "#111827",
    secondaryForeground: "#f3f4f6",
    muted: "#111827",
    mutedForeground: "#9ca3af",
    destructive: "#f87171",
    destructiveForeground: "#000000",
    backdrop: "rgba(0, 0, 0, 0.60)",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 30,
};

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
};

export function getColors(theme: Theme) {
  return colors[theme === "system" ? getSystemTheme() : theme];
}

export function getSystemTheme(): ResolvedTheme {
  const colorScheme = Appearance.getColorScheme();
  return colorScheme === "dark" ? "dark" : "light";
}

const THEME_STORAGE_KEY = "cc_theme";

export async function loadTheme(): Promise<Theme | null> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {}
  return null;
}

export async function saveTheme(theme: Theme): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}
