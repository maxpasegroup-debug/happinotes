import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { typography, spacing, radius } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { login } from "../services/api";
import { saveToken } from "../services/authStorage";

export default function Login() {
  const router = useRouter();
  const { colors, mode } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    try {
      const response = await login(trimmedEmail, trimmedPassword);
      await saveToken(response.token);
      router.replace("/(app)/library");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      Alert.alert("Login Failed", message);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          padding: spacing.lg,
        },
        logoContainer: {
          alignItems: "center",
          marginBottom: spacing.xl,
        },
        logo: {
          width: 180,
          height: 160,
        },
        title: {
          ...typography.h1,
          color: colors.textPrimary,
          textAlign: "center",
          marginBottom: spacing.sm,
        },
        subtitle: {
          ...typography.body,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: spacing.xl,
        },
        input: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          borderRadius: radius.md,
          marginBottom: spacing.md,
          color: colors.textPrimary,
          fontSize: typography.body.fontSize,
        },
        passwordContainer: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          marginBottom: spacing.sm,
        },
        forgotPasswordLink: {
          alignSelf: "flex-end",
          marginBottom: spacing.lg,
        },
        forgotPasswordText: {
          ...typography.small,
          color: colors.primary,
        },
        signupRow: {
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          marginTop: spacing.xl,
          gap: spacing.xs,
        },
        signupPrompt: {
          ...typography.body,
          color: colors.textSecondary,
        },
        signupLink: {
          ...typography.body,
          fontWeight: "600",
          color: colors.primary,
        },
        passwordInput: {
          flex: 1,
          padding: spacing.md,
          color: colors.textPrimary,
          fontSize: typography.body.fontSize,
        },
        eyeButton: {
          paddingHorizontal: spacing.md,
        },
        eyeButtonText: {
          fontSize: 18,
          color: colors.textSecondary,
        },
        gradientButton: {
          padding: spacing.lg,
          borderRadius: radius.lg,
          alignItems: "center",
        },
        buttonText: {
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: typography.body.fontSize,
        },
      }),
    [colors]
  );

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
      <Text style={styles.subtitle}>Sign in to continue</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={!showPassword}
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeButton}
        >
          <Text style={styles.eyeButtonText}>
            {showPassword ? "🙈" : "👁"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.forgotPasswordLink}
        onPress={() => router.push("/forgot-password")}
        activeOpacity={0.7}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleLogin} activeOpacity={0.9}>
        <LinearGradient
          colors={colors.primaryGradient}
          style={styles.gradientButton}
        >
          <Text style={styles.buttonText}>Login</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.signupRow}>
        <Text style={styles.signupPrompt}>Don't have an account?</Text>
        <TouchableOpacity
          onPress={() => router.push("/signup")}
          activeOpacity={0.7}
        >
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
