import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import {
  INSTALL_NOTES_MAX_LENGTH,
  POLE_NUMBER_MAX_LENGTH,
  validateInstallDraft,
  type InstallFieldErrors,
} from "@sllights/shared/install-submission";
import { useInstallQueue } from "@/installs/InstallQueueProvider";
import { PendingInstalls } from "@/installs/PendingInstalls";
import { SerialField } from "@/installs/SerialField";
import { POOR_ACCURACY_METERS, useLocationFix } from "@/location/useLocationFix";
import { BarcodeScannerModal } from "@/scan/BarcodeScannerModal";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { FieldLabel, TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

type ScanTarget = "lightHeadSerial" | "solarPanelSerial";
const SCAN_TITLES: Record<ScanTarget, string> = {
  lightHeadSerial: "Scan Light Head Serial Number",
  solarPanelSerial: "Scan Solar Panel Serial Number",
};

/**
 * Record a field install: solar panel and light head serials (scan or
 * type, in the sticker's order), pole number, and the current location (captured automatically,
 * no internet needed) — all required — plus optional notes. Submit saves it on the
 * phone first and sends it when there's a connection — so it works out of
 * signal and nothing is lost.
 */
export default function InstallScreen() {
  const { submit } = useInstallQueue();
  const { state: location, capture } = useLocationFix({ auto: true });
  const [lightHeadSerial, setLightHeadSerial] = useState("");
  const [solarPanelSerial, setSolarPanelSerial] = useState("");
  const [poleNumber, setPoleNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<InstallFieldErrors>({});
  const [scanning, setScanning] = useState<ScanTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  const fix = location.status === "fixed" ? location.fix : null;

  async function handleSubmit() {
    setResult(null);
    const checked = validateInstallDraft({
      lightHeadSerial,
      solarPanelSerial,
      poleNumber,
      location: fix ? { latitude: fix.latitude, longitude: fix.longitude, accuracyMeters: fix.accuracyMeters } : null,
      notes,
    });
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const outcome = await submit({ ...checked.value, id: Crypto.randomUUID(), capturedAt: new Date().toISOString() });
      setResult(
        outcome === "sent"
          ? { tone: "success", message: `Install for ${checked.value.poleNumber} sent.` }
          : {
              tone: "warning",
              message: `Install for ${checked.value.poleNumber} saved on this phone. It will be sent automatically when you're back online.`,
            },
      );
      // Ready for the next pole; location stays (re-capture if you've moved).
      setLightHeadSerial("");
      setSolarPanelSerial("");
      setPoleNumber("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PendingInstalls />

        <View style={styles.card}>
          <Text style={styles.legend}>
            <Text style={styles.asterisk}>*</Text> Required
          </Text>
          {/* Solar panel first: the order the barcodes appear on the sticker. */}
          <SerialField
            label="Solar Panel Serial Number"
            required
            value={solarPanelSerial}
            onChangeText={setSolarPanelSerial}
            onScan={() => setScanning("solarPanelSerial")}
            error={errors.solarPanelSerial}
          />
          <SerialField
            label="Light Head Serial Number"
            required
            value={lightHeadSerial}
            onChangeText={setLightHeadSerial}
            onScan={() => setScanning("lightHeadSerial")}
            error={errors.lightHeadSerial}
          />
          <View style={styles.gap}>
            <TextField
              label="Pole Number"
              required
              value={poleNumber}
              onChangeText={setPoleNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={POLE_NUMBER_MAX_LENGTH}
              placeholder="e.g. PAS-4938"
            />
            {errors.poleNumber ? <Text style={styles.error}>{errors.poleNumber}</Text> : null}
          </View>

          <View style={styles.location} accessibilityLabel="Location coordinates">
            <FieldLabel label="Location Coordinates" required />
            {location.status === "locating" ? (
              <View style={styles.row}>
                <ActivityIndicator color={colors.accentStrong} />
                <Text style={styles.muted}>Finding your location…</Text>
              </View>
            ) : fix ? (
              <>
                <Text style={styles.coords} selectable>
                  Latitude {fix.latitude.toFixed(6)}
                </Text>
                <Text style={styles.coords} selectable>
                  Longitude {fix.longitude.toFixed(6)}
                </Text>
                <Text style={styles.muted}>
                  {fix.accuracyMeters != null ? `Accurate to about ${Math.round(fix.accuracyMeters)} m` : "Accuracy unknown"}
                </Text>
                {fix.accuracyMeters != null && fix.accuracyMeters > POOR_ACCURACY_METERS ? (
                  <Text style={styles.warning}>Location is imprecise. Step into the open and refresh.</Text>
                ) : null}
              </>
            ) : location.status === "denied" ? (
              <>
                <Text style={styles.warning}>Location access is off. Turn it on to submit — every install needs its location.</Text>
                <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
              </>
            ) : location.status === "error" ? (
              <Text style={styles.warning}>{location.message}</Text>
            ) : null}
            {/* Getting a location is essential when there isn't one; refreshing is occasional, so it's just a small link. */}
            {location.status !== "locating" && !fix ? (
              <Button label="Get location" variant="secondary" onPress={() => void capture()} />
            ) : null}
            {location.status !== "locating" && fix ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Refresh location" onPress={() => void capture()} hitSlop={8} style={styles.refresh}>
                <Text style={styles.link}>Refresh location</Text>
              </Pressable>
            ) : null}
            {errors.location && !fix ? <Text style={styles.error}>{errors.location}</Text> : null}
          </View>

          <View style={styles.gap}>
            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={INSTALL_NOTES_MAX_LENGTH}
              placeholder="Anything the office should know"
            />
            {errors.notes ? <Text style={styles.error}>{errors.notes}</Text> : null}
          </View>

          {result ? <Banner tone={result.tone} message={result.message} /> : null}
          <Button label="Submit" loading={saving} onPress={() => void handleSubmit()} />
        </View>
      </ScrollView>

      <BarcodeScannerModal
        // A fresh scanner for every scan: no earlier reading (e.g. the other
        // serial's) can carry over and be used by mistake.
        key={scanning ?? "closed"}
        visible={scanning !== null}
        title={scanning ? SCAN_TITLES[scanning] : ""}
        onClose={() => setScanning(null)}
        onScanned={(value) => {
          if (scanning === "lightHeadSerial") setLightHeadSerial(value);
          if (scanning === "solarPanelSerial") setSolarPanelSerial(value);
          setScanning(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.lg,
  },
  gap: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  location: { gap: space.xs, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md },
  coords: { fontSize: 16, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
  muted: { fontSize: 13, color: colors.inkMuted },
  warning: { fontSize: 13, color: colors.statusWarning },
  error: { fontSize: 13, color: colors.statusFlagged },
  legend: { fontSize: 13, color: colors.inkMuted },
  asterisk: { color: colors.statusFlagged, fontWeight: "700" },
  refresh: { alignSelf: "flex-start", marginTop: 2 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
});
