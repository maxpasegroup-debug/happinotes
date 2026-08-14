import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { MiniPlayer } from "@/components/MiniPlayer";
import { PlayerProvider } from "@/store/playerStore";
import { getAuth } from "@/store/authStore";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const [role, setRole] = useState<"user" | "admin" | null>(null);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const loadRole = async () => {
      const { user } = await getAuth();
      if (user?.role === "admin") {
        router.replace("/(admin)/dashboard");
        return;
      }
      setRole("user");
    };
    loadRole();
  }, [router]);

  if (role === null) return null;

  return (
    <PlayerProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#FF6B4A",
        }}
      >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="collections"
        options={{
          title: t("collections"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: t("search"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: role === "admin" ? undefined : null,
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

      <Tabs.Screen
        name="book/[id]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="player"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="subscribe"
        options={{
          href: null,
        }}
      />
      </Tabs>
      <MiniPlayer />
    </PlayerProvider>
  );
}
