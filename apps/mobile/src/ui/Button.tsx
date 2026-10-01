import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radius, space, touch } from "./theme";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
}

export function Button({ label, variant = "primary", loading = false, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.ink : colors.surface} />
      ) : (
        <Text style={[styles.label, variant === "secondary" && styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.minHeight,
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.accentStrong },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.statusFlagged },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  label: { color: colors.surface, fontSize: 17, fontWeight: "600" },
  secondaryLabel: { color: colors.ink },
});
