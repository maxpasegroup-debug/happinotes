import { useColorScheme } from "react-native";
import { DARK_COLORS, LIGHT_COLORS } from "./colors";
import type { ThemeColors } from "./colors";

export function useAppTheme(): {
  colors: ThemeColors;
  isDark: boolean;
} {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  return { colors, isDark };
}
