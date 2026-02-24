import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";

export default function AdminEntry() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: "700" }}>
        👑 Admin Panel
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: "#FF6B4A",
          padding: 16,
          borderRadius: 12,
          marginTop: 20,
        }}
        onPress={() => router.push("/(admin)/dashboard")}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          Open Admin Dashboard
        </Text>
      </TouchableOpacity>
    </View>
  );
}