import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GatewayPolesResponse } from "@sllights/shared/api-contract";
import { installReadiness, type InstallProjectSetup } from "@sllights/shared/install-options";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/ui/Button";
import { SelectField } from "@/ui/SelectField";
import { colors, space, type } from "@/ui/theme";
import { SerialField } from "./SerialField";

type Gateway = InstallProjectSetup["gateways"][number];

/** How a gateway reads in the list: its group name, then its code. */
export const gatewayLabel = (g: Gateway) => (g.name === g.code ? g.code : `${g.name} · ${g.code}`);

/**
 * Box 2 of the Install screen: the chosen project's setup and gateway.
 *  - Not set up: Step 1 (warehouse) — "Set up project" (needs the internet).
 *  - No gateway: Step 2 (warehouse) — register one under the project's
 *    gateway pole (scan the gateway serial; needs the internet).
 *  - With gateways: the crew chooses the Gateway to install poles for (the
 *    only one is chosen automatically); while a gateway pole is still
 *    without a gateway, "Register another gateway" offers it (online).
 * The screen never names the vendor behind it: people see "set up project"
 * and "gateway".
 */
export function ProjectSetupBox({
  projectId,
  setup,
  gatewaySerial,
  onChangeGatewaySerial,
  onScanGateway,
  online,
  settingUp,
  onSetUp,
  registering,
  onRegister,
  selectedGatewayCode,
  onSelectGateway,
  gatewayError,
}: {
  projectId: string;
  setup: InstallProjectSetup | undefined;
  gatewaySerial: string;
  onChangeGatewaySerial: (text: string) => void;
  onScanGateway: () => void;
  /** Setting up and registering need the internet (the warehouse has it). */
  online: boolean;
  /** True while "Set up project" is working. */
  settingUp: boolean;
  onSetUp: () => void;
  /** True while "Register gateway" is working. */
  registering: boolean;
  /** Register the entered serial for this gateway pole. */
  onRegister: (poleNumber: string) => void;
  /** The gateway poles will be installed for. */
  selectedGatewayCode: string | null;
  onSelectGateway: (code: string) => void;
  /** From Submit, when no gateway is chosen. */
  gatewayError?: string;
}) {
  const readiness = installReadiness(setup);
  const register = { projectId, gatewaySerial, onChangeGatewaySerial, onScanGateway, online, registering, onRegister };

  return (
    <View style={styles.box} testID="project-setup">
      <Text style={styles.title} accessibilityRole="header">
        Project setup
      </Text>

      {readiness === "needsLeadsunProject" ? (
        <>
          <Text style={type.small}>Step 1 (warehouse)</Text>
          <Button label="Set up project" loading={settingUp} disabled={!online} onPress={onSetUp} />
          {!online ? <Text style={styles.note}>Setting up a project needs an internet connection.</Text> : null}
        </>
      ) : readiness === "needsGateway" ? (
        <>
          <Text style={type.small}>Step 2 (warehouse)</Text>
          <RegisterGateway {...register} mode="first" />
        </>
      ) : setup ? (
        <>
          <SelectField
            label="Gateway"
            required
            placeholder="Choose a gateway"
            options={setup.gateways.map((g) => ({ value: g.code, label: gatewayLabel(g) }))}
            value={selectedGatewayCode}
            onChange={onSelectGateway}
            emptyText="No gateways registered yet."
            error={gatewayError}
          />
          <RegisterGateway {...register} mode="another" />
        </>
      ) : (
        <Text style={styles.note}>Refresh the project list (while you have signal) to choose a gateway.</Text>
      )}
    </View>
  );
}

/**
 * Registering a gateway under one of the project's gateway poles: the poles
 * come from the server (online). "first" (Step 2) explains every state;
 * "another" only appears when a gateway pole is still without a gateway.
 */
function RegisterGateway({
  mode,
  projectId,
  gatewaySerial,
  onChangeGatewaySerial,
  onScanGateway,
  online,
  registering,
  onRegister,
}: {
  mode: "first" | "another";
  projectId: string;
  gatewaySerial: string;
  onChangeGatewaySerial: (text: string) => void;
  onScanGateway: () => void;
  online: boolean;
  registering: boolean;
  onRegister: (poleNumber: string) => void;
}) {
  const { api } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const key = `${projectId}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; poles?: GatewayPolesResponse["poles"]; error?: string } | null>(null);
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void api
      .getGatewayPoles(projectId)
      .then((res) => !cancelled && setLoaded({ key, poles: res.poles }))
      .catch((err: unknown) => !cancelled && setLoaded({ key, error: err instanceof Error ? err.message : "Please try again." }));
    return () => {
      cancelled = true;
    };
  }, [api, projectId, key, online]);
  const current = loaded?.key === key ? loaded : null;
  const openPoles = (current?.poles ?? []).filter((p) => !p.registered);
  const [chosenPole, setChosenPole] = useState<{ projectId: string; pole: string } | null>(null);
  const gatewayPole =
    openPoles.length === 1
      ? openPoles[0].poleNumber
      : chosenPole?.projectId === projectId && openPoles.some((p) => p.poleNumber === chosenPole.pole)
        ? chosenPole.pole
        : null;
  const canRegister = online && !registering && Boolean(gatewaySerial.trim()) && Boolean(gatewayPole);

  // "Register another gateway" stays out of the way unless there's one to register.
  if (mode === "another" && (!online || !current || current.error || openPoles.length === 0)) return null;

  return (
    <View style={styles.box} testID={mode === "another" ? "register-another-gateway" : "register-gateway"}>
      {mode === "another" ? (
        <Text style={styles.subtitle} accessibilityRole="header">
          Register another gateway
        </Text>
      ) : null}
      {!online ? (
        <Text style={styles.note}>Registering a gateway needs an internet connection.</Text>
      ) : !current ? (
        <Text style={styles.note}>Finding the gateway pole…</Text>
      ) : current.error ? (
        <View style={styles.row}>
          <Text style={styles.note}>Couldn&apos;t load the gateway poles: {current.error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => setAttempt((n) => n + 1)} hitSlop={8}>
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </View>
      ) : openPoles.length === 0 ? (
        <Text style={styles.note}>No pole in this project is marked as a gateway pole yet.</Text>
      ) : openPoles.length === 1 ? (
        <Text style={styles.gateway}>Gateway pole: {openPoles[0].poleNumber}</Text>
      ) : (
        <SelectField
          label="Gateway Pole"
          required
          placeholder="Choose the gateway pole"
          options={openPoles.map((p) => ({ value: p.poleNumber, label: p.poleNumber }))}
          value={gatewayPole}
          onChange={(pole) => setChosenPole({ projectId, pole })}
          emptyText="Every gateway pole already has a gateway."
        />
      )}
      <SerialField label="Gateway Serial Number" required value={gatewaySerial} onChangeText={onChangeGatewaySerial} onScan={onScanGateway} />
      <Button
        label="Register gateway"
        loading={registering}
        disabled={!canRegister}
        onPress={() => gatewayPole && onRegister(gatewayPole)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  subtitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: space.sm },
  note: { fontSize: 13, color: colors.inkMuted },
  gateway: { fontSize: 16, fontWeight: "600", color: colors.ink },
  row: { gap: space.xs },
  link: { fontSize: 15, fontWeight: "600", color: colors.accentStrong },
});
