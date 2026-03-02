import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { resetPassword } from "../services/api";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email, otp } = useLocalSearchParams<{ email: string; otp: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword) {
      Alert.alert("Error", "Please enter a password");
      return;
    }
    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (!email || !otp) {
      Alert.alert("Error", "Missing email or verification code. Please start over.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email, otp, trimmedPassword);
      Alert.alert("Success", "Password reset successful", [
        {
          text: "OK",
          onPress: () => router.replace("/"),
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create new password</Text>
      <Text style={styles.subtitle}>
        Choose a strong password for your account.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="New password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#9ca3af"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    width: "100%",
    maxWidth: 340,
    height: 52,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 200,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
