import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GatewayPolesResponse } from "@sllights/shared/api-contract";
import { installReadiness, type InstallProjectSetup } from "@sllights/shared/install-options";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/ui/Button";
import { SelectField } from "@/ui/SelectField";
import { colors, space, type } from "@/ui/theme";
import { SerialField } from "./SerialField";

/**
 * Box 2 of the Install screen: the warehouse's setup of the chosen project,
 * which must be done (with internet) before field crews can install —
 * (1) create the project on Leadsun, then (2) register a gateway by its
 * serial number. Once a gateway exists, this lists the project's gateways.
 *
 * "Set up project" calls the server (populateLeadsunProject). "Register
 * gateway" registers the entered serial under the project's gateway pole
 * (populateLeadsunGateway): one pole is shown; several give a choice of
 * those without a gateway yet. Both need the internet. The screen never names Leadsun (the vendor
 * behind it): people see "set up this project" and "gateway".
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
}: {
  projectId: string;
  setup: InstallProjectSetup | undefined;
  gatewaySerial: string;
  onChangeGatewaySerial: (text: string) => void;
  onScanGateway: () => void;
  /** Setting up needs the internet (the warehouse has it). */
  online: boolean;
  /** True while "Set up project" is working. */
  settingUp: boolean;
  onSetUp: () => void;
  /** True while "Register gateway" is working. */
  registering: boolean;
  /** Register the entered serial for this gateway pole. */
  onRegister: (poleNumber: string) => void;
}) {
  const readiness = installReadiness(setup);
  const { api } = useAuth();

  // Step 2: the project's gateway poles, fetched (online) when it's needed.
  const wantPoles = readiness === "needsGateway" && online;
  const [attempt, setAttempt] = useState(0);
  const key = `${projectId}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; poles?: GatewayPolesResponse["poles"]; error?: string } | null>(null);
  useEffect(() => {
    if (!wantPoles) return;
    let cancelled = false;
    void api
      .getGatewayPoles(projectId)
      .then((res) => !cancelled && setLoaded({ key, poles: res.poles }))
      .catch((err: unknown) => !cancelled && setLoaded({ key, error: err instanceof Error ? err.message : "Please try again." }));
    return () => {
      cancelled = true;
    };
  }, [api, projectId, key, wantPoles]);
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
          <SerialField
            label="Gateway Serial Number"
            required
            value={gatewaySerial}
            onChangeText={onChangeGatewaySerial}
            onScan={onScanGateway}
          />
          <Button
            label="Register gateway"
            loading={registering}
            disabled={!canRegister}
            onPress={() => gatewayPole && onRegister(gatewayPole)}
          />
        </>
      ) : (
        <View style={styles.gateways}>
          <Text style={type.small}>{setup && setup.gateways.length === 1 ? "Gateway" : "Gateways"}</Text>
          {setup ? (
            setup.gateways.map((g) => (
              <Text key={g.code} style={styles.gateway} selectable>
                {g.name === g.code ? g.code : `${g.name} · ${g.code}`}
              </Text>
            ))
          ) : (
            <Text style={styles.note}>Refresh the project list to see this project&apos;s gateways.</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  note: { fontSize: 13, color: colors.inkMuted },
  gateways: { gap: space.xs },
  gateway: { fontSize: 16, fontWeight: "600", color: colors.ink },
  row: { gap: space.xs },
  link: { fontSize: 15, fontWeight: "600", color: colors.accentStrong },
});
