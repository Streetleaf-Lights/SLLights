import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, space, touch, type } from "./theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  /** Shows an asterisk after the label (screen readers hear "required"). */
  required?: boolean;
}

export function TextField({ label, required = false, style, multiline, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <FieldLabel label={label} required={required} />
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={required ? "Required" : undefined}
        placeholderTextColor={colors.inkFaint}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    minHeight: touch.minHeight,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 104, paddingTop: space.md, textAlignVertical: "top" },
  asterisk: { color: colors.statusFlagged, fontWeight: "700" },
});

/** A field label, with a red asterisk when required. */
export function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <Text style={type.label}>
      {label}
      {required ? (
        <Text style={styles.asterisk} accessibilityElementsHidden importantForAccessibility="no">
          {" *"}
        </Text>
      ) : null}
    </Text>
  );
}
