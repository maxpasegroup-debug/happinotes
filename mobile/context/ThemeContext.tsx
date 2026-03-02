import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useColorScheme } from "react-native";
import { themes, type ThemeMode, type ThemeColors } from "../constants/theme";

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const defaultContext: ThemeContextType = {
  mode: "light",
  colors: themes.light,
  toggleTheme: () => {},
};

const ThemeContext = createContext<ThemeContextType>(defaultContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(systemScheme === "dark" ? "dark" : "light");

  useEffect(() => {
    setMode(systemScheme === "dark" ? "dark" : "light");
  }, [systemScheme]);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const value: ThemeContextType = {
    mode,
    colors: themes[mode],
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
