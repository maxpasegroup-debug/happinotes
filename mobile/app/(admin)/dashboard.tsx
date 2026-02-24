import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/(admin)/users")}
      >
        <Text style={styles.cardText}>User Management</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/(admin)/books")}
      >
        <Text style={styles.cardText}>Manage Books</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push("/(admin)/settings")}
      >
        <Text style={styles.cardText}>Admin Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 30 },
  card: {
    backgroundColor: "#FF6B4A",
    padding: 20,
    borderRadius: 14,
    marginBottom: 15,
  },
  cardText: { color: "#fff", fontWeight: "600" },
});
