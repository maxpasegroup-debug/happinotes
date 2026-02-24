import { StyleSheet, Text, View } from "react-native";

export default function UsersManagement() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <Text>Coming Soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
});
