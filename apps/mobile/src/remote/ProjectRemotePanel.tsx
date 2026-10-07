import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ProjectRemoteResponse } from "@sllights/shared/api-contract";
import type { LampState, LightCommand, ProjectLightTarget } from "@sllights/shared/remote-control";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { colors, radius, space } from "@/ui/theme";
import { LampIndicator } from "./LampIndicator";
import { LightCommandForm, type AffectedLight } from "./LightCommandForm";

type Remote = NonNullable<ProjectRemoteResponse["remote"]>;

/** Which control is open: the whole project, one gateway, or one light — as the web's three Control links. */
type Action =
  | { kind: "project"; affected: AffectedLight[] }
  | { kind: "gateway"; code: string; name: string; affected: AffectedLight[] }
  | { kind: "light"; light: AffectedLight };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The web project page's Remote Control: the Leadsun project's gateways and
 * lights with live ON/OFF state, and Project / Gateway / per-light Control.
 * Project and Gateway commands list the affected poles with a switch each;
 * leaving any out sends just the included lights instead. Gateways start
 * collapsed (projects can have hundreds of lights). The server checks every
 * gateway and light named belongs to this project.
 */
export function ProjectRemotePanel({
  customerId,
  projectId,
  onClose,
  onReveal,
}: {
  customerId: string;
  projectId: string;
  onClose: () => void;
  /** Scrolls the screen to a light row (after a confirmed command). */
  onReveal?: (row: View, productName: string) => void;
}) {
  const { api } = useAuth();
  const load = useCallback(() => api.getProjectRemote(customerId, projectId), [api, customerId, projectId]);
  const { state, retry, refresh } = useApiQuery(load);
  const [action, setAction] = useState<Action | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Lights changed by the last confirmed command: shown "Just updated", and the first is scrolled to.
  const [updated, setUpdated] = useState<Set<string>>(new Set());
  const rows = useRef(new Map<string, View>());
  const revealNext = useRef<string | null>(null);

  // After a confirmed command re-renders the panel (gateway opened, status
  // refreshed), scroll to the first affected light. A ref, not state, so
  // this effect never sets state itself.
  useEffect(() => {
    const name = revealNext.current;
    if (!name || state.status !== "success" || state.refreshing) return;
    const row = rows.current.get(name);
    if (!row) return;
    revealNext.current = null;
    onReveal?.(row, name);
  });

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
        <Text style={styles.muted}>This project has no remote control.</Text>
        <Button label="Close" variant="secondary" onPress={onClose} />
      </View>
    );
  }

  const lightsOf = (gateway: Remote["gateways"][number]): AffectedLight[] =>
    gateway.lights.map((l) => ({
      gatewayName: gateway.name,
      poleNumber: l.poleNumber,
      productName: l.productName,
      providedProductId: l.providedProductId,
    }));
  const allLights = remote.gateways.flatMap(lightsOf);

  /** Whole scope when nothing's left out (as the web), otherwise just the included lights. */
  const targetFor = (current: Action, included: AffectedLight[]): ProjectLightTarget => {
    const names = included.map((l) => l.productName);
    if (current.kind === "light") return { kind: "lights", productNames: [current.light.productName] };
    if (included.length === current.affected.length) {
      return current.kind === "project" ? { kind: "project" } : { kind: "gateway", gatewayCode: current.code };
    }
    return { kind: "lights", productNames: names };
  };

  const send = async (command: LightCommand, included: AffectedLight[]) =>
    (await api.sendProjectLightCommand(customerId, projectId, { ...command, target: targetFor(action as Action, included) })).message;
  const readLamps = async () => {
    const r = (await api.getProjectRemote(customerId, projectId)).remote;
    return new Map<string, LampState>(r ? r.gateways.flatMap((g) => g.lights.map((l) => [l.providedProductId, l.lamp] as const)) : []);
  };

  const open = (next: Action) => {
    setUpdated(new Set());
    setAction(next);
  };

  const form = action ? (
    <LightCommandForm
      key={action.kind === "light" ? `light-${action.light.productName}` : action.kind === "gateway" ? `gw-${action.code}` : "project"}
      title={
        action.kind === "project"
          ? "Project Remote Control"
          : action.kind === "gateway"
            ? `Gateway Remote Control — ${action.name}`
            : `Light Remote Control — ${action.light.productName}`
      }
      affected={action.kind === "light" ? [action.light] : action.affected}
      selectable={action.kind !== "light"}
      send={send}
      readLamps={readLamps}
      onConfirmed={(_state, lights) => {
        // Open every gateway the command touched, mark the lights, refresh
        // their live state, then scroll to the first one (effect above).
        const names = new Set(lights.map((l) => l.productName));
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const g of remote.gateways) if (g.lights.some((l) => names.has(l.productName))) next.add(g.code);
          return next;
        });
        setUpdated(names);
        revealNext.current = lights[0]?.productName ?? null;
        refresh();
      }}
      onCancel={() => setAction(null)}
    />
  ) : null;

  const toggleGateway = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <View style={styles.panel} testID="project-remote-panel">
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.name}>{remote.projectName}</Text>
          <Text style={styles.muted}>
            {plural(remote.gateways.length, "Gateway", "Gateways")} · {plural(allLights.length, "Light", "Lights")}
          </Text>
        </View>
        <Button label="Project Control" variant="secondary" onPress={() => open({ kind: "project", affected: allLights })} />
      </View>
      {remote.statusError ? <Text style={styles.error}>{remote.statusError}</Text> : null}

      {form}

      {remote.gateways.map((gateway) => {
        const isOpen = expanded.has(gateway.code);
        return (
          <View key={gateway.code} style={styles.gateway}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${gateway.name}, ${plural(gateway.lights.length, "light", "lights")}`}
              accessibilityState={{ expanded: isOpen }}
              onPress={() => toggleGateway(gateway.code)}
              style={styles.gatewayHead}
            >
              <View style={styles.flex}>
                <Text style={styles.gatewayName}>{gateway.name}</Text>
                <Text style={styles.code}>{gateway.code}</Text>
                <Text style={styles.muted}>{plural(gateway.lights.length, "Light", "Lights")}</Text>
              </View>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.inkFaint} />
            </Pressable>
            <Button
              label="Gateway Control"
              variant="secondary"
              onPress={() => open({ kind: "gateway", code: gateway.code, name: gateway.name, affected: lightsOf(gateway) })}
            />
            {isOpen
              ? lightsOf(gateway).map((light, i) => (
                  <View
                    key={light.productName}
                    testID={`remote-light-${light.productName}`}
                    ref={(node) => {
                      if (node) rows.current.set(light.productName, node);
                      else rows.current.delete(light.productName);
                    }}
                    style={[styles.light, updated.has(light.productName) && styles.lightUpdated]}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.lightName}>{light.productName}</Text>
                      {updated.has(light.productName) ? <Text style={styles.updated}>Just updated</Text> : null}
                      <Text style={styles.code}>{light.providedProductId}</Text>
                    </View>
                    <LampIndicator lamp={gateway.lights[i].lamp} compact />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Control ${light.productName}`}
                      onPress={() => open({ kind: "light", light })}
                      hitSlop={10}
                    >
                      <Text style={styles.link}>Control</Text>
                    </Pressable>
                  </View>
                ))
              : null}
          </View>
        );
      })}

      <Button label="Close" variant="secondary" onPress={onClose} />
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
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  name: { fontSize: 17, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  gateway: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: space.sm },
  gatewayHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  gatewayName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  code: { fontSize: 12, color: colors.inkFaint, fontVariant: ["tabular-nums"] },
  light: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
  lightName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  lightUpdated: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingBottom: space.xs },
  updated: { fontSize: 11.5, fontWeight: "700", color: colors.accentStrong },
  link: { fontSize: 13, fontWeight: "600", color: colors.accentStrong },
});
