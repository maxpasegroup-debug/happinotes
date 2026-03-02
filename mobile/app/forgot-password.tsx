import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { typography, spacing, radius } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { forgotPassword } from "../services/api";

export default function ForgotPassword() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert("Error", "Enter your email");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(trimmed);
      router.push({
        pathname: "/verify-otp",
        params: { email: trimmed },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
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
        header: {
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
          marginBottom: spacing.lg,
          color: colors.textPrimary,
          fontSize: typography.body.fontSize,
        },
        button: {
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
      <Text style={styles.header}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we'll send you a 6-digit code to reset your password.
      </Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!loading}
      />

      <TouchableOpacity
        onPress={handleSendCode}
        disabled={loading}
        activeOpacity={0.9}
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        <LinearGradient
          colors={colors.primaryGradient}
          style={styles.button}
        >
          <Text style={styles.buttonText}>
            {loading ? "Sending…" : "Send code"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
