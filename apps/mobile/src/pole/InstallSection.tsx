import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { POLE_INSTALL_NOTES_MAX_LENGTH, validatePoleInstallRequest } from "@sllights/shared/api-contract";
import { ApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { POOR_ACCURACY_METERS, useLocationFix } from "@/location/useLocationFix";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space, type } from "@/ui/theme";

type Result = { tone: "success" | "error" | "warning"; message: string } | null;

export function InstallSection({ poleNumber, scannedValue }: { poleNumber: string; scannedValue: string | null }) {
  const { api } = useAuth();
  const { state: location, capture } = useLocationFix();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result>(null);

  async function handleSubmit() {
    if (location.status !== "fixed") return;
    const validation = validatePoleInstallRequest({
      poleNumber,
      scannedValue,
      latitude: location.fix.latitude,
      longitude: location.fix.longitude,
      accuracyMeters: location.fix.accuracyMeters,
      capturedAt: new Date().toISOString(),
      notes: notes.trim() ? notes : null,
    });
    if (!validation.ok) {
      setResult({ tone: "error", message: validation.error });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      await api.submitPoleInstall(validation.value);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ tone: "success", message: `Install recorded for ${poleNumber}.` });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = err instanceof Error ? err.message : "Couldn't record the install.";
      // 501 = backend not wired yet: not the crew's fault, so not shown as an error.
      setResult({ tone: err instanceof ApiError && err.status === 501 ? "warning" : "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  const fix = location.status === "fixed" ? location.fix : null;
  const poorAccuracy = fix?.accuracyMeters != null && fix.accuracyMeters > POOR_ACCURACY_METERS;

  return (
    <View style={styles.section}>
      <Text style={type.heading}>Record install</Text>

      {fix ? (
        <View style={styles.fix}>
          <Text style={type.small}>Location</Text>
          <Text style={styles.coords} selectable>
            {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
          </Text>
          <Text style={type.small}>
            {fix.accuracyMeters != null ? `Accurate to about ${Math.round(fix.accuracyMeters)} m` : "Accuracy unknown"}
          </Text>
        </View>
      ) : null}
      {poorAccuracy ? (
        <Banner tone="warning" message="Location is imprecise. Step into the open and capture it again." />
      ) : null}
      {location.status === "denied" ? (
        <Banner tone="error" message="Location access is off. Turn it on in Settings to record an install." />
      ) : null}
      {location.status === "error" ? <Banner tone="error" message={location.message} /> : null}

      <Button
        label={fix ? "Capture location again" : "Capture location"}
        variant={fix ? "secondary" : "primary"}
        loading={location.status === "locating"}
        onPress={() => void capture()}
      />

      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={POLE_INSTALL_NOTES_MAX_LENGTH}
        placeholder="Anything the office should know"
      />

      {result ? <Banner tone={result.tone} message={result.message} /> : null}
      <Button
        label="Record install"
        disabled={!fix || result?.tone === "success"}
        loading={submitting}
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  fix: { backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: space.md, gap: 2 },
  coords: { fontSize: 17, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
});
