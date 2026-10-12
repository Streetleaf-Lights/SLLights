import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/Button";
import { colors, radius, space } from "@/ui/theme";
import { useInstallQueue } from "./InstallQueueProvider";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/**
 * Installs saved on this phone and not yet accepted: waiting ones go out
 * automatically when there's a connection; failed ones (refused by the
 * server) wait for the crew to Retry or Delete. Nothing shows when the
 * queue is empty.
 */
export function PendingInstalls() {
  const { items, online, sending, sendNow, retry, remove } = useInstallQueue();
  if (items.length === 0) return null;
  const waitingCount = items.filter((i) => i.status === "waiting").length;

  const confirmDelete = (id: string, poleNumber: string) =>
    Alert.alert("Delete this install?", `The install for ${poleNumber} hasn't been sent. Deleting it removes it from this phone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove(id) },
    ]);

  return (
    <View style={styles.card} testID="pending-installs">
      <View style={styles.top}>
        <Text style={styles.title}>
          {waitingCount > 0 ? `Waiting to send (${waitingCount})` : "Needs attention"}
        </Text>
        <View style={[styles.badge, { backgroundColor: online ? colors.statusActiveBg : colors.statusWarningBg }]}>
          <Text style={[styles.badgeText, { color: online ? colors.statusActive : colors.statusWarning }]}>
            {online ? "Online" : "Offline"}
          </Text>
        </View>
      </View>
      {!online && waitingCount > 0 ? (
        <Text style={styles.muted}>Saved on this phone. They’ll be sent automatically when you’re back online.</Text>
      ) : null}

      {items.map((item) => (
        <View key={item.submission.id} style={styles.item} accessibilityLabel={`Install for ${item.submission.poleNumber}, ${item.status}`}>
          <View style={styles.itemTop}>
            <Text style={styles.pole}>{item.submission.poleNumber}</Text>
            <Text style={[styles.status, { color: item.status === "failed" ? colors.statusFlagged : colors.statusWarning }]}>
              {item.status === "failed" ? "Not accepted" : "Waiting"}
            </Text>
          </View>
          <Text style={styles.muted}>Captured {when(item.submission.capturedAt)}</Text>
          {item.lastError ? (
            <Text style={[styles.muted, item.status === "failed" && styles.error]}>{item.lastError}</Text>
          ) : null}
          {item.status === "failed" ? (
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${item.submission.poleNumber}`} onPress={() => void retry(item.submission.id)} hitSlop={8}>
                <Text style={styles.link}>Retry</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${item.submission.poleNumber}`}
                onPress={() => confirmDelete(item.submission.id, item.submission.poleNumber)}
                hitSlop={8}
              >
                <Text style={[styles.link, styles.error]}>Delete</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}

      {waitingCount > 0 ? (
        <Button label="Send now" variant="secondary" loading={sending} onPress={() => void sendNow({ force: true })} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  badge: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  item: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm, gap: 2 },
  itemTop: { flexDirection: "row", justifyContent: "space-between" },
  pole: { fontSize: 15, fontWeight: "700", color: colors.ink },
  status: { fontSize: 13, fontWeight: "600" },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { color: colors.statusFlagged },
  actions: { flexDirection: "row", gap: space.lg, marginTop: 2 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
});
