import { Stack } from "expo-router";

export default function AdminLayout() {
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