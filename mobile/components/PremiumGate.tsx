import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title?: string;
  message?: string;
};

export function PremiumGate({
  title = "Premium chapter",
  message = "Unlock this audiobook with a Premium plan.",
}: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={22} color="#FF6B4A" />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={styles.button} onPress={() => router.push("/(app)/subscribe")}>
        <Text style={styles.buttonText}>Go Premium</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "rgba(255,245,241,0.96)",
    borderColor: "#FFD7C7",
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginBottom: 10,
    width: 44,
  },
  title: {
    color: "#181818",
    fontSize: 16,
    fontWeight: "900",
  },
  message: {
    color: "#667085",
    marginTop: 6,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#FF6B4A",
    borderRadius: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
