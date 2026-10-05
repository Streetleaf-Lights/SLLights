import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { parsePoleCode } from "@sllights/shared/scan";
import { SCAN_BARCODE_TYPES } from "@/scan/config";
import { createScanGate } from "@/scan/scanGate";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space, touch, type } from "@/ui/theme";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(createScanGate()).current;

  // Only run the camera while this tab is on screen (battery, and so the
  // pole screen can't be re-opened behind itself), and re-arm the scanner
  // each time the crew member comes back.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      gate.rearm();
      return () => {
        setFocused(false);
        setTorchOn(false);
      };
    }, [gate]),
  );

  const openPole = useCallback(
    (raw: string, scannedValue: string | null) => {
      const result = parsePoleCode(raw);
      if (!result.ok) {
        setError(result.error);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        gate.rearm(); // the same bad code stays on cooldown, so this doesn't loop
        return;
      }
      setError(null);
      setManualValue("");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/pole/[poleNumber]",
        params: { poleNumber: result.poleNumber, ...(scannedValue ? { scanned: scannedValue } : {}) },
      });
    },
    [gate, router],
  );

  const handleScan = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (!gate.accept(data)) return;
      openPole(data, data);
    },
    [gate, openPole],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.viewfinder}>
          {!permission ? null : permission.granted ? (
            focused ? (
              <>
                <CameraView
                  testID="scanner-camera"
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  enableTorch={torchOn}
                  barcodeScannerSettings={{ barcodeTypes: SCAN_BARCODE_TYPES }}
                  onBarcodeScanned={handleScan}
                />
                <View style={styles.reticleWrap} pointerEvents="none">
                  <View style={styles.reticle} />
                  <Text style={styles.hint}>Point at the pole tag</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Flashlight"
                  accessibilityState={{ checked: torchOn }}
                  onPress={() => setTorchOn((on) => !on)}
                  style={[styles.torch, torchOn && styles.torchOn]}
                >
                  <Ionicons name={torchOn ? "flashlight" : "flashlight-outline"} size={26} color={torchOn ? colors.ink : colors.surface} />
                </Pressable>
              </>
            ) : null
          ) : (
            <View style={styles.permission}>
              <Ionicons name="camera-outline" size={40} color={colors.surface} />
              <Text style={styles.permissionTitle}>Camera access is off</Text>
              <Text style={styles.permissionBody}>
                The scanner needs the camera to read pole tags. You can still type a pole number below.
              </Text>
              {permission.canAskAgain ? (
                <Button label="Allow camera" onPress={() => void requestPermission()} />
              ) : (
                <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
              )}
            </View>
          )}
        </View>

        <View style={styles.panel}>
          {error ? <Banner tone="error" message={error} /> : null}
          <Text style={type.heading}>Tag won’t scan?</Text>
          <View style={styles.manualRow}>
            <View style={styles.flex}>
              <TextField
                label="Pole number"
                placeholder="e.g. PAS-4938"
                value={manualValue}
                onChangeText={setManualValue}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={() => openPole(manualValue, null)}
              />
            </View>
            <Button
              label="Open"
              variant="secondary"
              disabled={!manualValue.trim()}
              onPress={() => openPole(manualValue, null)}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const RETICLE = 240;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  viewfinder: { flex: 1, backgroundColor: colors.ink, overflow: "hidden" },
  reticleWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: space.lg },
  reticle: {
    width: RETICLE,
    height: RETICLE,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  hint: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(18,22,29,0.6)",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  torch: {
    position: "absolute",
    top: space.lg,
    right: space.lg,
    width: touch.minHeight,
    height: touch.minHeight,
    borderRadius: touch.minHeight / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,22,29,0.6)",
  },
  torchOn: { backgroundColor: colors.surface },
  permission: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  permissionTitle: { color: colors.surface, fontSize: 20, fontWeight: "700" },
  permissionBody: { color: colors.surfaceSunken, fontSize: 16, lineHeight: 22, textAlign: "center", marginBottom: space.sm },
  panel: { backgroundColor: colors.surface, padding: space.lg, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  manualRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
});
