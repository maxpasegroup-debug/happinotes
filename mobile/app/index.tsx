import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setLoading(true);
    const result = await api.post<AuthResponse>(
      "/auth/login",
      { email: normalizedEmail, password },
      { skipAuth: true }
    );
    setLoading(false);

    if (!result.success || !result.data) {
      setError(result.error || "Login failed.");
      return;
    }

    await saveAuth(result.data.token, result.data.user);
    router.replace(result.data.user.role === "admin" ? "/(admin)/dashboard" : "/(app)/home");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/happinotes-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Welcome Back</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          onPress={() => setShowPassword((value) => !value)}
          style={styles.eyeButton}
        >
          <Text style={styles.eyeText}>{showPassword ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
      </TouchableOpacity>

      <Pressable onPress={() => router.push("/forgot-password")}>
        <Text style={styles.link}>Forgot Password?</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/signup")}>
        <Text style={styles.link}>{"Don't have account? Sign Up"}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    padding: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    width: 180,
    height: 160,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#F2F2F2",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 14,
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
  },
  eyeButton: {
    paddingHorizontal: 15,
  },
  eyeText: {
    color: "#FF6B4A",
    fontWeight: "700",
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
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  link: {
    marginTop: 18,
    textAlign: "center",
    color: "#555555",
    fontWeight: "600",
  },
});
