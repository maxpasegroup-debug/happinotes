export const LIGHT_COLORS = {
  background: "#FAF6F0",
  surface: "#FFFFFF",
  primary: "#F59E0B",
  accent: "#FB923C",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
} as const;

export const DARK_COLORS = {
  background: "#111827",
  surface: "#1F2937",
  primary: "#F59E0B",
  accent: "#FB923C",
  textPrimary: "#F9FAFB",
  textSecondary: "#D1D5DB",
} as const;

export type ThemeColors = typeof LIGHT_COLORS | typeof DARK_COLORS;
