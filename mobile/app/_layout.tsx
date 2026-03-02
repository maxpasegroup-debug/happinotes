import { useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { ThemeProvider } from "../context/ThemeContext";
import { getToken } from "../services/authStorage";

const AUTH_CHECK_TIMEOUT_MS = 15000;

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const currentInApp = segments[0] === "(app)";
    console.log("[RootLayout] Auth check: reading token from storage...");
    const timeoutPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => {
        console.warn("[RootLayout] Auth check timed out after", AUTH_CHECK_TIMEOUT_MS, "ms");
        resolve(null);
      }, AUTH_CHECK_TIMEOUT_MS);
    });

    Promise.race([getToken(), timeoutPromise])
      .then((token) => {
        if (token && !currentInApp) {
          console.log("[RootLayout] Auth check: token found, redirecting to app");
          router.replace("/(app)/library");
        } else if (!token && currentInApp) {
          console.log("[RootLayout] Auth check: no token, redirecting to login");
          router.replace("/");
        } else {
          console.log("[RootLayout] Auth check: no redirect needed", { token: !!token, inApp: currentInApp });
        }
      })
      .catch((err) => {
        console.error("[RootLayout] Auth check failed:", err);
      })
      .finally(() => {
        setIsChecking(false);
      });
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </AuthGate>
    </ThemeProvider>
  );
}
