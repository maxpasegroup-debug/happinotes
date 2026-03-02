import { Stack } from "expo-router";

export default function FavouritesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: "Favourites",
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
