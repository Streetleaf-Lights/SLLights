import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "./theme";

export interface Stat {
  label: string;
  value: string;
  /** Faults use the flagged colour, as on the web. */
  emphasis?: "flagged";
  /** Makes the tile a link (e.g. "Total faults" → the faulted poles). */
  onPress?: () => void;
}

/** Equal-width stat tiles — the mobile take on the web's StatGroup. */
export function StatRow({ stats, compact = false }: { stats: Stat[]; compact?: boolean }) {
  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <Pressable
          key={stat.label}
          disabled={!stat.onPress}
          onPress={stat.onPress}
          style={({ pressed }) => [styles.tile, compact && styles.tileCompact, stat.onPress && styles.linked, pressed && styles.pressed]}
          accessible
          accessibilityRole={stat.onPress ? "link" : undefined}
          accessibilityLabel={`${stat.label}: ${stat.value}`}
        >
          <Text
            style={[styles.value, compact && styles.valueCompact, stat.emphasis === "flagged" && styles.flagged]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {stat.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {stat.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: "center",
    gap: 2,
  },
  tileCompact: { backgroundColor: colors.bg, borderWidth: 0, paddingVertical: space.sm },
  value: { fontSize: 22, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  valueCompact: { fontSize: 16 },
  flagged: { color: colors.statusFlagged },
  linked: { borderColor: colors.statusFlaggedBg },
  pressed: { opacity: 0.6 },
  label: { fontSize: 12, color: colors.inkMuted },
});
