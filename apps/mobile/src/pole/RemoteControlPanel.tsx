import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  CONFIRM_INTERVAL_MS,
  COOLDOWN_SECONDS,
  DEFAULT_BRIGHTNESS,
  DEFAULT_TIME_SECONDS,
  expectedLampState,
  lightButtonLabel,
  MAX_CONFIRM_ATTEMPTS,
  TIME_MAX_SECONDS,
  TIME_MIN_SECONDS,
  validateLightCommand,
  type LampState,
} from "@sllights/shared/remote-control";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

type Confirm = "idle" | "confirming" | "confirmed" | "unconfirmed";

/**
 * The web pole page's Remote Control, inline: the pole's Leadsun product,
 * its live ON/OFF state (fetched fresh when opened) and device id; then
 * "Control" opens the Light Remote Control form — Brightness 0–100
 * (default 50) and Time 1–3600 s (default 30) — whose button reads GO! /
 * TURN OFF. After a command it re-checks live status every second (up to
 * 15 times) until the lamp matches, with a 10 s cooldown between commands.
 * The server decides which lamp this is; the app only sends brightness/time.
 */
export function RemoteControlPanel({
  customerId,
  projectId,
  poleId,
  onClose,
}: {
  customerId: string;
  projectId: string;
  poleId: string;
  onClose: () => void;
}) {
  const { api } = useAuth();
  const load = useCallback(() => api.getPoleRemote(customerId, projectId, poleId), [api, customerId, projectId, poleId]);
  const { state, retry } = useApiQuery(load);

  const [liveLamp, setLiveLamp] = useState<LampState | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);
  const [timeText, setTimeText] = useState(String(DEFAULT_TIME_SECONDS));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [confirm, setConfirm] = useState<Confirm>("idle");
  const [expected, setExpected] = useState<"on" | "off">("on");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(() => alive.current && fn(), ms));
  };

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    for (let s = 1; s <= COOLDOWN_SECONDS; s++) later(() => setCooldown(COOLDOWN_SECONDS - s), s * 1000);
  };

  /** Re-check live status every second until it matches, up to MAX_CONFIRM_ATTEMPTS. */
  const startConfirming = (want: "on" | "off") => {
    setExpected(want);
    setConfirm("confirming");
    const attempt = (n: number) =>
      later(async () => {
        const lamp = await api
          .getPoleRemote(customerId, projectId, poleId)
          .then((r) => r.remote?.lamp ?? "unknown")
          .catch(() => "unknown" as const);
        if (!alive.current) return;
        if (lamp === want) {
          setLiveLamp(lamp);
          setConfirm("confirmed");
        } else if (n >= MAX_CONFIRM_ATTEMPTS) {
          setConfirm("unconfirmed");
        } else {
          attempt(n + 1);
        }
      }, CONFIRM_INTERVAL_MS);
    attempt(1);
  };

  const command = validateLightCommand({ brightness, time: Number(timeText) });

  async function submit() {
    if (!command.ok) return;
    setSubmitting(true);
    setResult(null);
    setConfirm("idle");
    try {
      const res = await api.sendLightCommand(customerId, projectId, poleId, command.value);
      if (!alive.current) return;
      setResult({ ok: true, message: res.message });
      startConfirming(expectedLampState(command.value.brightness));
    } catch (err) {
      if (!alive.current) return;
      setResult({ ok: false, message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      if (alive.current) {
        setSubmitting(false);
        // A failed attempt still counts against Leadsun's rate limit, as on the web.
        startCooldown();
      }
    }
  }

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
  const lamp = liveLamp ?? remote.lamp;
  const label = lightButtonLabel({ submitting, cooldownRemaining: cooldown, brightness });

  return (
    <View style={styles.panel} testID="remote-control-panel">
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.product}>{remote.productName}</Text>
          <Text style={styles.deviceId} selectable>
            {remote.providedProductId}
          </Text>
          {remote.gatewayName ? <Text style={styles.muted}>Gateway: {remote.gatewayName}</Text> : null}
        </View>
        <LampIndicator lamp={lamp} />
      </View>
      {remote.statusError ? <Text style={styles.error}>{remote.statusError}</Text> : null}

      {formOpen ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Light Remote Control</Text>
          <Text style={styles.label}>Brightness ({brightness})</Text>
          <Slider
            testID="brightness-slider"
            accessibilityLabel="Brightness"
            minimumValue={BRIGHTNESS_MIN}
            maximumValue={BRIGHTNESS_MAX}
            step={1}
            value={brightness}
            onValueChange={(v: number) => setBrightness(Math.round(v))}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accentStrong}
          />
          <TextField
            label="Time (seconds)"
            value={timeText}
            onChangeText={(t) => setTimeText(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={4}
          />
          {!command.ok && timeText !== "" ? (
            <Text style={styles.error}>
              Time must be {TIME_MIN_SECONDS}–{TIME_MAX_SECONDS} seconds.
            </Text>
          ) : null}
          <Button
            label={label}
            variant={brightness === 0 ? "secondary" : "primary"}
            disabled={submitting || cooldown > 0 || !command.ok}
            onPress={() => void submit()}
          />
          {result ? <Banner tone={result.ok ? "success" : "error"} message={result.message} /> : null}
        </View>
      ) : null}

      {confirm === "confirming" ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accentStrong} />
          <Text style={styles.muted}>Confirming the light is {expected.toUpperCase()}…</Text>
        </View>
      ) : null}
      {confirm === "confirmed" ? <Banner tone="success" message={`Confirmed: the light is ${expected.toUpperCase()}.`} /> : null}
      {confirm === "unconfirmed" ? (
        <View style={styles.gap}>
          <Banner tone="warning" message="Didn't confirm — the light may not have changed yet." />
          <Button label="Check again" variant="secondary" onPress={() => startConfirming(expected)} />
        </View>
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

function LampIndicator({ lamp }: { lamp: LampState }) {
  const tone =
    lamp === "on"
      ? { bg: colors.statusActiveBg, fg: colors.statusActive, text: "ON" }
      : lamp === "off"
        ? { bg: colors.surfaceSunken, fg: colors.inkMuted, text: "OFF" }
        : { bg: colors.surfaceSunken, fg: colors.inkFaint, text: "Unknown" };
  return (
    <View style={[styles.lamp, { backgroundColor: tone.bg }]} accessible accessibilityLabel={`Light is ${tone.text}`}>
      <View style={[styles.lampDot, { backgroundColor: tone.fg }]} />
      <Text style={[styles.lampText, { color: tone.fg }]}>{tone.text}</Text>
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
  gap: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  product: { fontSize: 17, fontWeight: "700", color: colors.ink },
  deviceId: { fontSize: 13, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  form: { gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  formTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  label: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  lamp: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 4 },
  lampDot: { width: 8, height: 8, borderRadius: 4 },
  lampText: { fontSize: 13, fontWeight: "700" },
});
