import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FieldLabel, TextField } from "@/ui/TextField";
import { colors, radius, space, touch } from "@/ui/theme";

/**
 * A serial number, scan first: a large Scan button (Rescan once captured)
 * shows the captured value; "Won't scan? Type it instead" reveals a text
 * field for a damaged or unreadable tag.
 */
export function SerialField({
  label,
  required = false,
  value,
  onChangeText,
  onScan,
  error,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onScan: () => void;
  error?: string;
}) {
  const [typing, setTyping] = useState(false);
  const hasValue = value.trim().length > 0;

  return (
    <View style={styles.gap}>
      <FieldLabel label={label} required={required} />

      {hasValue && !typing ? (
        <View style={styles.captured} accessible accessibilityLabel={`${label}: ${value}`}>
          <Ionicons name="checkmark-circle" size={20} color={colors.statusActive} />
          <Text style={styles.value} selectable numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${hasValue ? "Rescan" : "Scan"} ${label}`}
        onPress={onScan}
        style={({ pressed }) => [styles.scan, hasValue && styles.rescan, pressed && styles.pressed]}
      >
        <Ionicons name="barcode-outline" size={22} color={hasValue ? colors.accentStrong : colors.surface} />
        <Text style={[styles.scanText, hasValue && styles.rescanText]}>{hasValue ? "Rescan" : "Scan"}</Text>
      </Pressable>

      {typing ? (
        <TextField label={label} value={value} onChangeText={onChangeText} autoCapitalize="characters" autoCorrect={false} placeholder="Type the serial number" />
      ) : (
        <Pressable accessibilityRole="link" accessibilityLabel={`Won't scan? Type the ${label} instead`} onPress={() => setTyping(true)} hitSlop={8}>
          <Text style={styles.link}>Won’t scan? Type it instead</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  captured: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.statusActiveBg,
  },
  value: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"], letterSpacing: 0.5 },
  scan: {
    minHeight: touch.minHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accentStrong,
  },
  rescan: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.accentStrong, minHeight: touch.minHeight - 8 },
  pressed: { opacity: 0.85 },
  scanText: { color: colors.surface, fontSize: 17, fontWeight: "600" },
  rescanText: { color: colors.accentStrong, fontSize: 15 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
  error: { fontSize: 13, color: colors.statusFlagged },
});
