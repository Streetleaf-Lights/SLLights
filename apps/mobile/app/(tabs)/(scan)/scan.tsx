import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { installReadiness, remainingInstallOptions, stickerKey } from "@sllights/shared/install-options";
import {
  INSTALL_NOTES_MAX_LENGTH,
  validateInstallDraft,
  type InstallFieldErrors,
} from "@sllights/shared/install-submission";
import { useInstallQueue } from "@/installs/InstallQueueProvider";
import { PendingInstalls } from "@/installs/PendingInstalls";
import { ProjectSetupBox } from "@/installs/ProjectSetupBox";
import { SerialField } from "@/installs/SerialField";
import { useFormScroll } from "@/installs/useFormScroll";
import { useInstallOptions } from "@/installs/useInstallOptions";
import { POOR_ACCURACY_METERS, useLocationFix } from "@/location/useLocationFix";
import { BarcodeScannerModal } from "@/scan/BarcodeScannerModal";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { SelectField } from "@/ui/SelectField";
import { FieldLabel, TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

type ScanTarget = "lightHeadSerial" | "solarPanelSerial" | "gatewaySerial";
const SCAN_TITLES: Record<ScanTarget, string> = {
  lightHeadSerial: "Scan Light Head Serial Number",
  solarPanelSerial: "Scan Solar Panel Serial Number",
  gatewaySerial: "Scan Gateway Serial Number",
};

/**
 * The Install screen, used by two teams (both the Streetleaf Crew role):
 *  - Box 1: the project (both teams).
 *  - Box 2: the warehouse's setup of that project, with internet — create
 *    it on Leadsun, then register its gateway (scan the gateway serial).
 *  - Box 3: the field install, shown only once the project has a gateway;
 *    until then, a note says what's missing (and to Refresh in signal).
 *
 * Box 3 records a field install: the project's sticker (the pole number) —
 * from dropdowns that work offline and leave out stickers already
 * submitted — then the solar panel and light head serials (scan or type, in
 * the sticker's order) and the current location (captured automatically,
 * no internet needed): all required, plus optional notes. Submit saves it on the
 * phone first and sends it when there's a connection — so it works out of
 * signal and nothing is lost.
 */
export default function InstallScreen() {
  const { submit, submittedStickers, items } = useInstallQueue();
  const options = useInstallOptions();
  // Projects and stickers not yet submitted from this phone (a project with none left drops out).
  const remaining = remainingInstallOptions(options.projects, submittedStickers);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sticker, setSticker] = useState<string | null>(null);
  const project = remaining.find((p) => p.id === projectId) ?? null;
  // Field installs (Box 3) need the warehouse's setup done: a gateway.
  const readiness = project ? installReadiness(project.setup) : null;
  const [gatewaySerial, setGatewaySerial] = useState("");
  const { state: location, capture } = useLocationFix({ auto: true });
  const [lightHeadSerial, setLightHeadSerial] = useState("");
  const [solarPanelSerial, setSolarPanelSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<InstallFieldErrors>({});
  const [scanning, setScanning] = useState<ScanTarget | null>(null);
  const [saving, setSaving] = useState(false);
  // The outcome of the last Submit. A "saved on this phone" message belongs to
  // its install, and stops showing once that install has been sent (left the
  // phone); if the server refuses it instead, it stays, with Needs attention.
  const [result, setResult] = useState<{ tone: "success" | "warning"; message: string; installId?: string } | null>(null);
  const resultShown =
    result && !(result.installId && !items.some((item) => item.submission.id === result.installId)) ? result : null;

  const fix = location.status === "fixed" ? location.fix : null;

  // Notes scrolls into view above the keyboard; after Submit, back to the top.
  const { scrollRef, bottomFieldProps: notesScroll, showTop } = useFormScroll();

  async function handleSubmit() {
    setResult(null);
    const checked = validateInstallDraft({
      lightHeadSerial,
      solarPanelSerial,
      projectId: project?.id ?? "",
      poleNumber: project && sticker && project.stickerNumbers.includes(sticker) ? sticker : "",
      location: fix ? { latitude: fix.latitude, longitude: fix.longitude, accuracyMeters: fix.accuracyMeters } : null,
      notes,
    });
    if (!checked.ok) {
      setErrors(checked.errors);
      showTop(); // the first fields (Project, Sticker) are at the top
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const installId = Crypto.randomUUID();
      const outcome = await submit({ ...checked.value, id: installId, capturedAt: new Date().toISOString() });
      setResult(
        outcome === "sent"
          ? { tone: "success", message: `Install for ${checked.value.poleNumber} sent.` }
          : {
              tone: "warning",
              message: `Install for ${checked.value.poleNumber} saved on this phone. It will be sent automatically when you're back online.`,
              installId,
            },
      );
      // Up to the top, where the outcome now shows beside the waiting/offline card.
      showTop();
      // Ready for the next pole: this sticker is now used, so it leaves the
      // list. The project stays chosen while it has stickers left (the crew
      // is usually doing the next pole of the same job); it's cleared once
      // its last sticker is used — it drops out of the list then too.
      // Location stays (re-capture if you've moved).
      const left = remainingInstallOptions(options.projects, new Set([...submittedStickers, stickerKey(checked.value.projectId, checked.value.poleNumber)]));
      if (!left.some((p) => p.id === checked.value.projectId)) setProjectId(null);
      setSticker(null);
      setLightHeadSerial("");
      setSolarPanelSerial("");
      setNotes("");
    } finally {
      setSaving(false);
    }
  }

  // Keyboard room: "padding" on Android too — edge-to-edge Android apps (Expo
  // SDK 54+) are no longer resized for the keyboard, so the form makes room.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* The outcome of the last Submit, at the top with the waiting/offline card. */}
        {resultShown ? <Banner tone={resultShown.tone} message={resultShown.message} /> : null}
        <PendingInstalls />

        <Text style={styles.legend}>
          <Text style={styles.asterisk}>*</Text> Required
        </Text>

        {/* Box 1: the project. */}
        <View style={styles.card} testID="box-project">
          <SelectField
            label="Project"
            required
            placeholder={remaining.length ? "Choose a project" : "No projects to install"}
            options={remaining.map((p) => ({ value: p.id, label: p.name, detail: p.customerName }))}
            value={project ? project.id : null}
            onChange={(id) => {
              setProjectId(id);
              setSticker(null);
              setGatewaySerial("");
            }}
            emptyText="No projects have stickers left to install."
            error={errors.projectId}
          />
          <View style={styles.listStatus}>
            <Text style={styles.muted}>
              {options.source === "none"
                ? options.loading
                  ? "Loading projects…"
                  : "Projects couldn't be loaded. Connect to the internet once to download them."
                : `${options.source === "saved" ? "Saved list" : "Updated"} ${new Date(options.updatedAt ?? "").toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh project list" onPress={() => void options.refresh()} hitSlop={8}>
              <Text style={styles.link}>{options.loading ? "Refreshing…" : "Refresh"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Box 2: the warehouse's setup of the project (Leadsun project, gateway). */}
        {project ? (
          <View style={styles.card} testID="box-setup">
            <ProjectSetupBox
              setup={project.setup}
              gatewaySerial={gatewaySerial}
              onChangeGatewaySerial={setGatewaySerial}
              onScanGateway={() => setScanning("gatewaySerial")}
            />
          </View>
        ) : null}

        {/* Box 3: the field install — only once the project has a gateway. */}
        {project && readiness !== "ready" ? (
          <View style={styles.card} testID="box-not-ready">
            <Text style={styles.notReadyTitle}>Not ready for installs yet</Text>
            <Text style={styles.muted}>
              {readiness === "needsLeadsunProject"
                ? "The warehouse needs to set this project up on Leadsun and register its gateway before poles can be installed."
                : "The warehouse needs to register this project's gateway before poles can be installed."}{" "}
              If they&apos;ve just done it, tap Refresh above while you have signal.
            </Text>
          </View>
        ) : null}
        {project && readiness === "ready" ? (
          <View style={styles.card} testID="box-install">
            <SelectField
              label="Sticker / Pole Number"
              required
              disabled={!project}
              placeholder={project ? "Choose a sticker" : "Choose a project first"}
              options={(project?.stickerNumbers ?? []).map((n) => ({ value: n, label: n }))}
              value={sticker}
              onChange={setSticker}
              emptyText="Every sticker in this project has been submitted."
              error={errors.poleNumber}
            />

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
                {...notesScroll}
              />
              {errors.notes ? <Text style={styles.error}>{errors.notes}</Text> : null}
            </View>

            <Button label="Submit" loading={saving} onPress={() => void handleSubmit()} />
          </View>
        ) : null}
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
          if (scanning === "gatewaySerial") setGatewaySerial(value);
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
  notReadyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  asterisk: { color: colors.statusFlagged, fontWeight: "700" },
  refresh: { alignSelf: "flex-start", marginTop: 2 },
  listStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginTop: -space.sm },
  link: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
});
