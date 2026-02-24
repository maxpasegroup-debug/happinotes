import { ScrollView, StyleSheet, Text } from "react-native";

export default function History() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Subscription History</Text>

      <Text style={styles.text}>
        No subscription history available.
      </Text>

      <Text style={styles.text}>
        Renewal Date: Not Available
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  text: {
    marginTop: 10,
    color: "#555",
  },
});
