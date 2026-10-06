import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space } from "./theme";

/**
 * "‹ Coastal Power" — an arrow plus the name of the screen it goes back to.
 * Drawn by the app rather than left to the native header: iOS drops a back
 * label to "Back" (or a bare arrow) when it judges the name too long, and
 * Android never shows one, so the native label isn't dependable. Long
 * names are cut off with "…". Edge-swipe back on iOS still works.
 */
export function HeaderBackButton({ label, onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? `Back to ${label}` : "Back"}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="chevron-back" size={24} color={colors.accentStrong} />
      {label ? (
        <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Leaves room for the (empty) title; long labels are truncated within it.
  button: { flexDirection: "row", alignItems: "center", maxWidth: 260, paddingRight: space.sm, marginLeft: -6 },
  pressed: { opacity: 0.5 },
  label: { flexShrink: 1, fontSize: 17, color: colors.accentStrong },
});
