import { Stack } from "expo-router";

export default function ContentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Content",
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
