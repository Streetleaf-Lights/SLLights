import { StyleSheet, Text, View } from "react-native";
import { installReadiness, type InstallProjectSetup } from "@sllights/shared/install-options";
import { Button } from "@/ui/Button";
import { colors, space, type } from "@/ui/theme";
import { SerialField } from "./SerialField";

/**
 * Box 2 of the Install screen: the warehouse's setup of the chosen project,
 * which must be done (with internet) before field crews can install —
 * (1) create the project on Leadsun, then (2) register a gateway by its
 * serial number. Once a gateway exists, this lists the project's gateways.
 *
 * "Set up project" calls the server (populateLeadsunProject). Registering a
 * gateway isn't connected yet: its button is shown but switched off, with a
 * plain note, rather than pretending to work. The screen never names Leadsun (the vendor
 * behind it): people see "set up this project" and "gateway".
 */
export function ProjectSetupBox({
  setup,
  gatewaySerial,
  onChangeGatewaySerial,
  onScanGateway,
  online,
  settingUp,
  onSetUp,
}: {
  setup: InstallProjectSetup | undefined;
  gatewaySerial: string;
  onChangeGatewaySerial: (text: string) => void;
  onScanGateway: () => void;
  /** Setting up needs the internet (the warehouse has it). */
  online: boolean;
  /** True while "Set up project" is working. */
  settingUp: boolean;
  onSetUp: () => void;
}) {
  const readiness = installReadiness(setup);

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
          <SerialField
            label="Gateway Serial Number"
            required
            value={gatewaySerial}
            onChangeText={onChangeGatewaySerial}
            onScan={onScanGateway}
          />
          <Button label="Register gateway" disabled onPress={() => undefined} />
          <Text style={styles.note}>Registering gateways from the app isn&apos;t available yet.</Text>
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
});
