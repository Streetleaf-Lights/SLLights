import { StyleSheet, Text, View } from "react-native";
import type { PasswordChecks } from "@sllights/shared/password";
import { PasswordField } from "@/ui/PasswordField";
import { colors, space } from "@/ui/theme";

/**
 * Password + Confirm Password with the web forms' live checklist ("At least
 * 8 characters", "At least 1 special character") and match status.
 */
export function NewPasswordFields({
  password,
  confirmation,
  checks,
  onPassword,
  onConfirmation,
}: {
  password: string;
  confirmation: string;
  checks: PasswordChecks;
  onPassword: (text: string) => void;
  onConfirmation: (text: string) => void;
}) {
  return (
    <View style={styles.gap}>
      <PasswordField label="Password" value={password} onChangeText={onPassword} />
      <View style={styles.rules} accessibilityLabel="Password requirements">
        <Rule met={checks.hasMinLength}>At least 8 characters</Rule>
        <Rule met={checks.hasSpecialChar}>At least 1 special character</Rule>
      </View>
      <PasswordField
        label="Confirm Password"
        value={confirmation}
        onChangeText={onConfirmation}
        invalid={confirmation.length > 0 && !checks.matches}
      />
      {confirmation.length > 0 ? (
        <Text style={[styles.match, { color: checks.matches ? colors.statusActive : colors.statusFlagged }]}>
          {checks.matches ? "Passwords match." : "Passwords do not match."}
        </Text>
      ) : null}
    </View>
  );
}

function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <Text
      style={[styles.rule, { color: met ? colors.statusActive : colors.inkFaint }]}
      accessibilityLabel={`${children}: ${met ? "met" : "not yet met"}`}
    >
      {met ? "✓" : "•"} {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  rules: { gap: 2 },
  rule: { fontSize: 13 },
  match: { fontSize: 13 },
});
