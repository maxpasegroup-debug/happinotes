import { StyleSheet, Text, View } from "react-native";

export default function SubscribePlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Go Premium</Text>
      <Text style={styles.text}>Subscription plans and Razorpay checkout arrive in Phase 4.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#181818",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
  },
  text: {
    color: "#667085",
    textAlign: "center",
  },
});
