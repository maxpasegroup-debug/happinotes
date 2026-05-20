import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { AuthUser, clearAuth, getAuth, saveAuth } from "@/store/authStore";

void SplashScreen.preventAutoHideAsync();

type MeResponse = {
  success: boolean;
  user: AuthUser;
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { token } = await getAuth();
      const currentGroup = segments[0];
      const authRoute = !currentGroup || currentGroup === "signup" || currentGroup === "forgot-password";

      if (!token) {
        if (!authRoute) router.replace("/");
        setReady(true);
        await SplashScreen.hideAsync();
        return;
      }

      const result = await api.get<MeResponse>("/auth/me");
      if (!result.success || !result.data?.user) {
        await clearAuth();
        router.replace("/");
      } else {
        await saveAuth(token, result.data.user);
        if (authRoute) {
          router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
        }
      }

      setReady(true);
      await SplashScreen.hideAsync();
    };

    checkSession();
  }, [router, segments]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
