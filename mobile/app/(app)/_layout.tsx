import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { getMe } from "../../services/api";
import type { ApiUser } from "../../services/api";
import { getToken } from "../../services/authStorage";

export default function AppLayout() {
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const token = await getToken();
      if (!token) return;
      try {
        const response = await getMe(token);
        if (!cancelled) {
          setUser(response.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

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
          title: "Library",
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