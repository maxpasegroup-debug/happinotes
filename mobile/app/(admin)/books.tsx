import { StyleSheet, Text, View } from "react-native";

export default function ManageBooks() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Books</Text>
      <Text>Create, Edit, Publish books here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
});
