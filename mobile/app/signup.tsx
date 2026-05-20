import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "@/services/api";
import { AuthUser, saveAuth } from "@/store/authStore";

type AuthResponse = {
  success: boolean;
  token: string;
  user: AuthUser;
};

export default function Signup() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!name.trim() || !normalizedEmail || !password || !confirmPassword) {
      setError("Please fill all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const result = await api.post<AuthResponse>(
      "/auth/signup",
      { name: name.trim(), email: normalizedEmail, password },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success || !result.data) {
      setError(result.error || "Signup failed.");
      return;
    }

    await saveAuth(result.data.token, result.data.user);
    router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create Account</Text>

      <TextInput
        placeholder="Full Name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm Password"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#F2F2F2",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  error: {
    color: "#B42318",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#FF6B4A",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    marginTop: 20,
    textAlign: "center",
    color: "#555555",
  },
});
