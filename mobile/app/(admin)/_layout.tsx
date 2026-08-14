import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { clearAuth } from "@/store/authStore";

export default function AdminLayout() {
  const router = useRouter();

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
