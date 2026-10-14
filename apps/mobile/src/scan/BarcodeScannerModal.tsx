import { useRef, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import * as Haptics from "expo-haptics";
import { modalSystemBars, useModalSafeArea } from "@/ui/modalSafeArea";
import { Ionicons } from "@expo/vector-icons";
import { SCAN_BARCODE_TYPES } from "@/scan/config";
import { barcodeCenter, createSteadyReading, insideFrame, type Rect } from "@/scan/scanFrame";
import { Button } from "@/ui/Button";
import { colors, radius, space, touch } from "@/ui/theme";

/**
 * A full-screen barcode reader for one field. It never grabs a code on its
 * own: it shows the code it's currently reading, large, and fills the field
 * only when the crew tap "Use this code". That gives them time to aim — a
 * serial sticker carries two barcodes close together — and to check the
 * value against the number printed on the sticker. Only the barcode inside
 * the frame counts (the neighbour is ignored even when in view), and a code
 * shows only once it's been read steadily, so the readout doesn't flicker. Torch included; explains
 * and offers Settings when camera access is off. Callers give it a new
 * `key` per scan so every scan starts with nothing read.
 */
export function BarcodeScannerModal({
  visible,
  title,
  onScanned,
  onClose,
}: {
  visible: boolean;
  title: string;
  onScanned: (value: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // Clear of the status bar and home indicator on both platforms (see modalSafeArea.ts).
  const safeArea = useModalSafeArea();
  const [torchOn, setTorchOn] = useState(false);
  // The code currently in the frame. Updates as the crew move the phone;
  // nothing is used until they confirm it.
  const [detected, setDetected] = useState<string | null>(null);
  // A barcode is in view but not in the frame (e.g. the sticker's other one).
  const [offFrame, setOffFrame] = useState(false);
  // Where the frame sits in the camera view (measured on layout).
  const frame = useRef<Rect | null>(null);
  const steady = useRef(createSteadyReading());

  const handleScan = (result: BarcodeScanningResult) => {
    const value = result.data?.trim();
    if (!value) return;
    // Only the barcode inside the frame counts: a sticker carries two close
    // together, and the camera sees both. (If the phone gives no position
    // for this barcode type, it's accepted as before.)
    const center = barcodeCenter(result);
    if (frame.current && center && !insideFrame(center, frame.current)) {
      if (!offFrame) setOffFrame(true);
      return;
    }
    const steadyValue = steady.current(value);
    if (!steadyValue) return; // still settling — avoids flicker
    if (offFrame) setOffFrame(false);
    if (steadyValue === detected) return;
    setDetected(steadyValue);
    void Haptics.selectionAsync(); // a light tick when a (new) code is read
  };

  const confirm = () => {
    if (!detected) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScanned(detected);
    setDetected(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      {...modalSystemBars}
    >
      <View style={[styles.safe, safeArea]}>
        <View style={styles.top}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel scanning" onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <View style={styles.viewfinder}>
          {!permission ? null : permission.granted ? (
            <>
              <CameraView
                testID="barcode-camera"
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torchOn}
                barcodeScannerSettings={{ barcodeTypes: SCAN_BARCODE_TYPES }}
                onBarcodeScanned={handleScan}
              />
              <View style={styles.reticleWrap} pointerEvents="none">
                <View
                  testID="scan-frame"
                  style={styles.reticle}
                  onLayout={(e) => {
                    frame.current = e.nativeEvent.layout;
                  }}
                />
                <Text style={styles.hint}>Line up one barcode inside the frame</Text>
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
          ) : (
            <View style={styles.permission}>
              <Ionicons name="camera-outline" size={40} color={colors.surface} />
              <Text style={styles.permissionTitle}>Camera access is off</Text>
              <Text style={styles.permissionBody}>Allow the camera to scan, or type the serial number instead.</Text>
              {permission.canAskAgain ? (
                <Button label="Allow camera" onPress={() => void requestPermission()} />
              ) : (
                <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
              )}
            </View>
          )}
        </View>
        {permission?.granted ? (
          <View style={styles.readout}>
            <Text style={styles.readoutLabel}>
              {detected ? "Reading" : offFrame ? "Barcode found — line it up inside the frame" : "Looking for a barcode…"}
            </Text>
            <Text style={styles.readoutValue} numberOfLines={1} accessibilityLiveRegion="polite" testID="detected-code">
              {detected ?? "—"}
            </Text>
            <Text style={styles.readoutHint}>Check it matches the number printed on the sticker.</Text>
            <Button label="Use this code" disabled={!detected} onPress={confirm} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const RETICLE_W = 280;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.lg },
  title: { color: colors.surface, fontSize: 18, fontWeight: "700" },
  cancel: { color: colors.surface, fontSize: 16, fontWeight: "600" },
  viewfinder: { flex: 1, overflow: "hidden" },
  reticleWrap: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: space.lg },
  // Wide and short, to fit one barcode of the sticker's pair.
  reticle: { width: RETICLE_W, height: 110, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.accent },
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
  readout: { padding: space.lg, gap: space.xs, backgroundColor: colors.ink },
  readoutLabel: { color: colors.inkFaint, fontSize: 13, fontWeight: "600" },
  readoutValue: { color: colors.surface, fontSize: 26, fontWeight: "700", letterSpacing: 1, fontVariant: ["tabular-nums"] },
  readoutHint: { color: colors.inkFaint, fontSize: 13, marginBottom: space.sm },
  permissionBody: { color: colors.surfaceSunken, fontSize: 16, lineHeight: 22, textAlign: "center", marginBottom: space.sm },
});
