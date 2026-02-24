import { ScrollView, StyleSheet, Text } from "react-native";

export default function Legal() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Legal</Text>

      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.text}>
        Your privacy policy content goes here.
      </Text>

      <Text style={styles.title}>Terms & Conditions</Text>
      <Text style={styles.text}>
        Your terms and conditions content goes here.
      </Text>

      <Text style={styles.title}>Refund Policy</Text>
      <Text style={styles.text}>
        Your refund policy content goes here.
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
  },
  text: {
    marginTop: 8,
    color: "#555",
  },
});
