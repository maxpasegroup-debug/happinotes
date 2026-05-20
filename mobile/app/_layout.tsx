import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import Toast from "react-native-toast-message";
import { api } from "@/services/api";
import "@/i18n";
import { AuthUser, clearAuth, getAuth, saveAuth } from "@/store/authStore";
import { registerPushNotifications } from "@/services/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
        const seenOnboarding = await AsyncStorage.getItem("seen_onboarding");
        if (!authRoute) router.replace(seenOnboarding ? "/" : "/onboarding");
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
        void registerPushNotifications();
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
    <>
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
    <Toast />
    </>
  );
}
