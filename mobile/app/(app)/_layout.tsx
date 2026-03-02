import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Tabs } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getMe } from "../../services/api";
import type { ApiUser } from "../../services/api";
import { deleteToken, getToken } from "../../services/authStorage";

export default function AppLayout() {
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    let cancelled = false;

    async function check() {
      console.log("[AppLayout] Auth check: reading token...");
      const token = await getToken();
      if (!token) {
        console.log("[AppLayout] Auth check: no token, redirecting to login");
        if (!cancelled) {
          setStatus("unauthenticated");
          router.replace("/");
        }
        return;
      }
      try {
        console.log("[AppLayout] Auth check: calling GET /auth/me...");
        const response = await getMe(token);
        if (!cancelled) {
          console.log("[AppLayout] Auth check: getMe success", response?.user?.email ?? "(no email)");
          setUser(response.user);
          setStatus("authenticated");
        }
      } catch (err) {
        console.error("[AppLayout] Auth check: getMe failed", err);
        if (!cancelled) {
          await deleteToken();
          setUser(null);
          setStatus("unauthenticated");
          router.replace("/");
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FF6B4A",
      }}
    >
      <Tabs.Screen
        name="library"
        options={{
          title: "Lifebooks",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="collections"
        options={{
          title: "My Collection",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: user?.role === "admin" ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="shield-checkmark-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* 🔒 Hidden Screens (NOT TABS) */}

      <Tabs.Screen
        name="legal"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
