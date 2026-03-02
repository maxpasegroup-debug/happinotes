export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  primaryGradient: string[];
  textPrimary: string;
  textSecondary: string;
  border: string;
  danger: string;
}

const lightTheme: ThemeColors = {
  background: "#FAF6F0",
  surface: "#FFFFFF",
  primary: "#F59E0B",
  primaryGradient: ["#F59E0B", "#FB923C"],
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  danger: "#DC2626",
};

const darkTheme: ThemeColors = {
  background: "#111827",
  surface: "#1F2937",
  primary: "#FBBF24",
  primaryGradient: ["#D97706", "#EA580C"],
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  border: "#374151",
  danger: "#DC2626",
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const },
  h2: { fontSize: 22, fontWeight: "600" as const },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};
