import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, touch, type } from "./theme";

/** A password input with the web form's show/hide toggle. */
export function PasswordField({
  label,
  value,
  onChangeText,
  autoComplete = "new-password",
  invalid = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  autoComplete?: "new-password" | "current-password";
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.box, invalid && styles.invalid]}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={autoComplete === "new-password" ? "newPassword" : "password"}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onPress={() => setShown((s) => !s)}
          hitSlop={8}
          style={styles.toggle}
        >
          <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={colors.inkMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  box: {
    minHeight: touch.minHeight,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  invalid: { borderColor: colors.statusFlagged },
  input: { flex: 1, paddingHorizontal: space.md, fontSize: 17, color: colors.ink, minHeight: touch.minHeight },
  toggle: { paddingHorizontal: space.md },
});
