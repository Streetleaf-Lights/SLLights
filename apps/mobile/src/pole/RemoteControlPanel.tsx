import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { LampState } from "@sllights/shared/remote-control";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { LampIndicator } from "@/remote/LampIndicator";
import { LightCommandForm } from "@/remote/LightCommandForm";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { colors, radius, space } from "@/ui/theme";

/**
 * The web pole page's Remote Control, inline: the pole's Leadsun product,
 * live ON/OFF (fetched fresh when opened), device id and gateway; "Control"
 * opens the Light Remote Control form. The server decides which lamp this
 * is — the app only sends brightness and time.
 */
export function RemoteControlPanel({
  customerId,
  projectId,
  poleId,
  onClose,
  onReveal,
}: {
  customerId: string;
  projectId: string;
  poleId: string;
  onClose: () => void;
  /** Scrolls the page to the panel's live ON/OFF (after a confirmed command). */
  onReveal?: (panel: View) => void;
}) {
  const { api } = useAuth();
  const load = useCallback(() => api.getPoleRemote(customerId, projectId, poleId), [api, customerId, projectId, poleId]);
  const { state, retry } = useApiQuery(load);
  const [liveLamp, setLiveLamp] = useState<LampState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const panelRef = useRef<View>(null);

  if (state.status === "loading") {
    return (
      <View style={styles.panel}>
        <ActivityIndicator accessibilityLabel="Loading remote control" color={colors.accentStrong} />
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={styles.panel}>
        <Banner tone="error" message={state.message} />
        <View style={styles.row}>
          <View style={styles.flex}><Button label="Close" variant="secondary" onPress={onClose} /></View>
          <View style={styles.flex}><Button label="Try again" variant="secondary" onPress={retry} /></View>
        </View>
      </View>
    );
  }
  const remote = state.data.remote;
  if (!remote) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>This pole has no remote control.</Text>
        <Button label="Close" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={styles.panel} testID="remote-control-panel" ref={panelRef}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.product}>{remote.productName}</Text>
          <Text style={styles.deviceId} selectable>
            {remote.providedProductId}
          </Text>
          {remote.gatewayName ? <Text style={styles.muted}>Gateway: {remote.gatewayName}</Text> : null}
        </View>
        <LampIndicator lamp={liveLamp ?? remote.lamp} />
      </View>
      {remote.statusError ? <Text style={styles.error}>{remote.statusError}</Text> : null}

      {formOpen ? (
        <LightCommandForm
          title="Light Remote Control"
          selectable={false}
          affected={[
            {
              gatewayName: remote.gatewayName,
              poleNumber: remote.productName,
              productName: remote.productName,
              providedProductId: remote.providedProductId,
            },
          ]}
          send={async (command) => (await api.sendLightCommand(customerId, projectId, poleId, command)).message}
          readLamps={async () => {
            const r = (await api.getPoleRemote(customerId, projectId, poleId)).remote;
            return new Map(r ? [[r.providedProductId, r.lamp]] : []);
          }}
          onConfirmed={(lamp) => {
            setLiveLamp(lamp);
            // Scroll back up to the live ON/OFF at the top of this panel.
            if (panelRef.current) onReveal?.(panelRef.current);
          }}
        />
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Close" variant="secondary" onPress={onClose} />
        </View>
        {formOpen ? null : (
          <View style={styles.flex}>
            <Button label="Control" onPress={() => setFormOpen(true)} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  product: { fontSize: 17, fontWeight: "700", color: colors.ink },
  deviceId: { fontSize: 13, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
});
