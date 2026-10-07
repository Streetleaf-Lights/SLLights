import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "./theme";

/**
 * A small, low-key header action (e.g. "Remote Control"): compact pill with
 * an icon, so it doesn't compete with the page content. hitSlop keeps the
 * touch area at a comfortable size despite the small visual.
 */
export function PillButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={14} color={colors.accentStrong} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    backgroundColor: colors.accentSoft,
  },
  pressed: { opacity: 0.6 },
  text: { fontSize: 12.5, fontWeight: "600", color: colors.accentStrong },
});
