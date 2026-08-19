import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import Toast, { BaseToast, type ToastConfig } from "react-native-toast-message";
import { api } from "@/services/api";
import "@/i18n";
import { AuthUser, getAuth, saveAuth } from "@/store/authStore";
import { listenForNotificationResponses, registerPushNotifications } from "@/services/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { LaunchSplash } from "@/components/LaunchSplash";

void SplashScreen.preventAutoHideAsync();

const MINIMUM_LAUNCH_SPLASH_MS = 1500;

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: "#16803C",
        borderLeftColor: "#16803C",
        borderRadius: 10,
        height: 54,
        minHeight: 54,
        width: "92%",
      }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}
      text2Style={{ color: "#E9F8EE", fontSize: 12, fontWeight: "600" }}
      text2NumberOfLines={1}
    />
  ),
};

type MeResponse = {
  success: boolean;
  user: AuthUser;
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const sessionCheckStarted = useRef(false);
  const nativeSplashHidden = useRef(false);

  const revealLaunchScreen = async () => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    await SplashScreen.hideAsync();
  };

  useEffect(() => {
    if (sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;

    const checkSession = async () => {
      const splashDelay = new Promise<void>((resolve) => {
        setTimeout(resolve, MINIMUM_LAUNCH_SPLASH_MS);
      });
      const { token, user: cachedUser } = await getAuth();
      const currentGroup = segments[0];
      const authRoute = !currentGroup || currentGroup === "signup" || currentGroup === "forgot-password";

      if (!token) {
        const seenOnboarding = await AsyncStorage.getItem("seen_onboarding");
        if (!authRoute) router.replace(seenOnboarding ? "/" : "/onboarding");
        await splashDelay;
        setReady(true);
        return;
      }

      const result = await api.get<MeResponse>("/auth/me");
      if (result.success && result.data?.user) {
        await saveAuth(token, result.data.user);
        void registerPushNotifications();
        if (authRoute) {
          router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
        }
      } else {
        // authFetch clears the session and redirects only for a confirmed 401.
        // Network/server failures must not log out a valid cached session.
        const { token: remainingToken } = await getAuth();
        if (remainingToken && cachedUser && authRoute) {
          router.replace(cachedUser.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
        }
      }

      await splashDelay;
      setReady(true);
    };

    checkSession();
  }, [router, segments]);

  useEffect(() => listenForNotificationResponses((bookId) => {
    router.push({ pathname: "/(app)/book/[id]", params: { id: bookId } });
  }), [router]);

  if (!ready) return <LaunchSplash onLayout={() => void revealLaunchScreen()} />;

  return (
    <RealtimeProvider>
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
      }}
    />
    <Toast config={toastConfig} position="bottom" bottomOffset={42} visibilityTime={3500} />
    </RealtimeProvider>
  );
}
