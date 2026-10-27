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
 * The two actions aren't connected yet (their Leadsun details are still to
 * come): the buttons are shown but switched off, with a plain note, rather
 * than pretending to work.
 */
export function ProjectSetupBox({
  setup,
  gatewaySerial,
  onChangeGatewaySerial,
  onScanGateway,
}: {
  setup: InstallProjectSetup | undefined;
  gatewaySerial: string;
  onChangeGatewaySerial: (text: string) => void;
  onScanGateway: () => void;
}) {
  const readiness = installReadiness(setup);

  return (
    <View style={styles.box} testID="project-setup">
      <Text style={styles.title} accessibilityRole="header">
        Project setup
      </Text>

      {readiness === "needsLeadsunProject" ? (
        <>
          <Text style={type.small}>Step 1 (warehouse): create this project on Leadsun.</Text>
          <Button label="Set up on Leadsun" disabled onPress={() => undefined} />
          <Text style={styles.note}>Setting up projects on Leadsun from the app isn&apos;t available yet.</Text>
        </>
      ) : readiness === "needsGateway" ? (
        <>
          <Text style={type.small}>Step 2 (warehouse): register this project&apos;s gateway.</Text>
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
