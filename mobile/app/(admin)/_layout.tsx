import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getMe } from "../../services/api";
import type { ApiUser } from "../../services/api";
import { getToken } from "../../services/authStorage";

export default function AdminLayout() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null | "loading">("loading");
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    let cancelled = false;

    async function check() {
      const token = await getToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          router.replace("/");
        }
        return;
      }
      try {
        const response = await getMe(token);
        if (!cancelled) {
          setUser(response.user);
          if (response.user.role !== "admin") {
            router.replace("/(app)/library");
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          router.replace("/");
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (user === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user === null || user.role !== "admin") {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="dashboard" options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="users" options={{ title: "User Management" }} />
      <Stack.Screen name="books" options={{ title: "Books Management" }} />
      <Stack.Screen name="settings" options={{ title: "Admin Settings" }} />
      <Stack.Screen name="create-book" options={{ title: "Create Book" }} />
      <Stack.Screen name="edit-book" options={{ title: "Edit Book" }} />
    </Stack>
  );
}
