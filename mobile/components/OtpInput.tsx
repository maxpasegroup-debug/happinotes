import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type Props = { value: string; onChange: (value: string) => void; hasError?: boolean };
const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, hasError = false }: Props) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? "");
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Enter 6-digit verification code" onPress={() => inputRef.current?.focus()} style={styles.wrapper}>
      <View style={styles.row} pointerEvents="none">
        {digits.map((digit, index) => (
          <View key={index} style={[styles.box, index === activeIndex && value.length < OTP_LENGTH && styles.activeBox, Boolean(digit) && styles.filledBox, hasError && styles.errorBox]}>
            <Text style={styles.digit}>{digit}</Text>
          </View>
        ))}
      </View>
      <TextInput ref={inputRef} value={value} onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, OTP_LENGTH))} keyboardType="number-pad" maxLength={OTP_LENGTH} autoComplete="sms-otp" textContentType="oneTimeCode" caretHidden selectionColor="transparent" style={styles.hiddenInput} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 20, position: "relative" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { alignItems: "center", backgroundColor: "#F5F3F1", borderColor: "#D5D0CC", borderRadius: 12, borderWidth: 1.5, flex: 1, height: 58, justifyContent: "center", maxWidth: 54 },
  activeBox: { borderColor: "#FF6B4A", borderWidth: 2 },
  filledBox: { backgroundColor: "#FFF8F5", borderColor: "#FF9A82" },
  errorBox: { borderColor: "#D92D20" },
  digit: { color: "#242424", fontSize: 24, fontWeight: "800" },
  hiddenInput: { ...StyleSheet.absoluteFillObject, opacity: 0.01 },
});
