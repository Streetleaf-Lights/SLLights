import { StyleSheet, Text, View } from "react-native";
import { isOpenIssue } from "@sllights/shared/api-contract";
import { formatTimestamp } from "@sllights/shared/format";
import type { PoleSummary } from "@sllights/shared/types";
import { colors, radius, space, type } from "@/ui/theme";

/** Same label colours the web uses for overallStatusText / connectedText. */
function statusColor(label: string | null): string {
  switch (label) {
    case "OK":
    case "Online":
      return colors.statusActive;
    case "Fault":
    case "Offline":
    case "Disconnected":
      return colors.statusFlagged;
    default:
      return colors.inkMuted;
  }
}

export function PoleSummaryCard({ poleNumber, pole }: { poleNumber: string; pole: PoleSummary | null }) {
  const openIssues = pole?.poleIssues.filter(isOpenIssue).length ?? 0;

  return (
    <View style={styles.card}>
      <Text style={type.label}>Pole number</Text>
      <Text style={type.code} selectable accessibilityLabel={`Pole ${poleNumber.split("").join(" ")}`}>
        {poleNumber}
      </Text>
      {pole ? (
        <View style={styles.grid}>
          <Fact label="Overall status" value={pole.overallStatusText ?? "—"} color={statusColor(pole.overallStatusText)} />
          <Fact label="Connected" value={pole.connectedText ?? "—"} color={statusColor(pole.connectedText)} />
          <Fact label="Installed" value={pole.installDate ? formatTimestamp(pole.installDate) : "Not recorded"} />
          <Fact
            label="Open issues"
            value={String(openIssues)}
            color={openIssues > 0 ? colors.statusFlagged : colors.ink}
          />
        </View>
      ) : null}
    </View>
  );
}

function Fact({ label, value, color = colors.ink }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.fact}>
      <Text style={type.small}>{label}</Text>
      <Text style={[styles.factValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.xs,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: space.md, rowGap: space.md },
  fact: { width: "50%", gap: 2 },
  factValue: { fontSize: 17, fontWeight: "600" },
});
