import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { clearAuth, getAuth } from "@/store/authStore";
import { useEffect, useState } from "react";

export default function AdminLayout() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    void getAuth().then(({ user }) => {
      if (user?.role !== "admin") {
        router.replace(user ? "/(app)/home" : "/");
        return;
      }
      setAuthorized(true);
    });
  }, [router]);

  const confirmLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearAuth();
          router.replace("/");
        },
      },
    ]);
  };

  if (!authorized) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          <Pressable onPress={confirmLogout} hitSlop={10}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="users" options={{ title: "User Management" }} />
      <Stack.Screen name="books" options={{ title: "Books Management" }} />
      <Stack.Screen name="create-book" options={{ title: "Create Book" }} />
      <Stack.Screen name="edit-book" options={{ title: "Edit Book" }} />
      <Stack.Screen name="notifications" options={{ title: "Push Notifications" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  logout: {
    color: "#D92D20",
    fontSize: 15,
    fontWeight: "700",
  },
});
