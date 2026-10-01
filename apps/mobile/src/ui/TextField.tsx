import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, space, touch, type } from "./theme";

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, multiline, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
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
});
