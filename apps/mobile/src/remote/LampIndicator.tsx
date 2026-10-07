import { StyleSheet, Text, View } from "react-native";
import type { LampState } from "@sllights/shared/remote-control";
import { colors, radius, space } from "@/ui/theme";

/** ON (green) / OFF (grey) / Unknown — a light's live state. */
export function LampIndicator({ lamp, compact = false }: { lamp: LampState; compact?: boolean }) {
  const tone =
    lamp === "on"
      ? { bg: colors.statusActiveBg, fg: colors.statusActive, text: "ON" }
      : lamp === "off"
        ? { bg: colors.surfaceSunken, fg: colors.inkMuted, text: "OFF" }
        : { bg: colors.surfaceSunken, fg: colors.inkFaint, text: "Unknown" };
  return (
    <View
      style={[styles.lamp, compact && styles.compact, { backgroundColor: tone.bg }]}
      accessible
      accessibilityLabel={`Light is ${tone.text}`}
    >
      <View style={[styles.dot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.text, compact && styles.compactText, { color: tone.fg }]}>{tone.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lamp: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
  compact: { paddingHorizontal: 6, paddingVertical: 2, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: "700" },
  compactText: { fontSize: 11.5 },
});
