import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "./theme";

type Tone = "error" | "success" | "warning";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  error: { bg: colors.statusFlaggedBg, fg: colors.statusFlagged },
  success: { bg: colors.statusActiveBg, fg: colors.statusActive },
  warning: { bg: colors.statusWarningBg, fg: colors.statusWarning },
};

/** Inline status message. Announced by screen readers as soon as it appears. */
export function Banner({ tone, message }: { tone: Tone; message: string }) {
  const { bg, fg } = TONES[tone];
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: bg, borderLeftColor: fg }]}
    >
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 4, borderRadius: radius.sm, padding: space.md },
  text: { fontSize: 15, lineHeight: 21, fontWeight: "500" },
});
