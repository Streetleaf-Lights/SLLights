import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
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
  type LightCommand,
} from "@sllights/shared/remote-control";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

export interface AffectedLight {
  gatewayName: string | null;
  poleNumber: string;
  productName: string;
  providedProductId: string;
}

type Confirm = "idle" | "confirming" | "confirmed" | "unconfirmed";

/**
 * The web's Remote Control form, shared by the pole and project panels:
 * Brightness 0–100 (default 50), Time 1–3600 s (default 30), GO! / TURN OFF,
 * a 10 s cooldown after every attempt, and — when `selectable` — the
 * "N poles affected" list with a switch per pole (all on by default).
 * After a successful send it re-reads live status every second (up to 15
 * times) until every included light is ON/OFF as requested.
 */
export function LightCommandForm({
  title,
  affected,
  selectable,
  send,
  readLamps,
  onConfirmed,
  onCancel,
}: {
  title: string;
  affected: AffectedLight[];
  selectable: boolean;
  /** Sends the command for the included lights; resolves with the server's message. */
  send: (command: LightCommand, included: AffectedLight[]) => Promise<string>;
  /** Live state by Leadsun device id. */
  readLamps: () => Promise<Map<string, LampState>>;
  onConfirmed?: (state: "on" | "off") => void;
  onCancel?: () => void;
}) {
  const [brightness, setBrightness] = useState(DEFAULT_BRIGHTNESS);
  const [timeText, setTimeText] = useState(String(DEFAULT_TIME_SECONDS));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [confirm, setConfirm] = useState<Confirm>("idle");
  const [expected, setExpected] = useState<"on" | "off">("on");
  const [checking, setChecking] = useState<AffectedLight[]>([]);

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

  const included = affected.filter((light) => !excluded.has(light.productName));
  const command = validateLightCommand({ brightness, time: Number(timeText) });
  const plural = checking.length !== 1;

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    for (let s = 1; s <= COOLDOWN_SECONDS; s++) later(() => setCooldown(COOLDOWN_SECONDS - s), s * 1000);
  };

  /** Re-read live state every second until every light being checked matches, up to MAX_CONFIRM_ATTEMPTS. */
  const startConfirming = (want: "on" | "off", lights: AffectedLight[]) => {
    setExpected(want);
    setChecking(lights);
    setConfirm("confirming");
    const attempt = (n: number) =>
      later(async () => {
        const lamps = await readLamps().catch(() => new Map<string, LampState>());
        if (!alive.current) return;
        if (lights.every((light) => lamps.get(light.providedProductId) === want)) {
          setConfirm("confirmed");
          onConfirmed?.(want);
        } else if (n >= MAX_CONFIRM_ATTEMPTS) {
          setConfirm("unconfirmed");
        } else {
          attempt(n + 1);
        }
      }, CONFIRM_INTERVAL_MS);
    attempt(1);
  };

  async function submit() {
    if (!command.ok || included.length === 0) return;
    const lights = included;
    setSubmitting(true);
    setResult(null);
    setConfirm("idle");
    try {
      const message = await send(command.value, lights);
      if (!alive.current) return;
      setResult({ ok: true, message });
      startConfirming(expectedLampState(command.value.brightness), lights);
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

  const toggle = (productName: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{title}</Text>
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

      {selectable ? (
        <View style={styles.affected}>
          <Text style={styles.label}>
            {included.length} of {affected.length} {affected.length === 1 ? "pole" : "poles"} affected
          </Text>
          <ScrollView style={styles.affectedList} nestedScrollEnabled>
            {affected.map((light) => (
              <View key={light.productName} style={styles.affectedRow}>
                <View style={styles.flex}>
                  <Text style={styles.pole}>{light.poleNumber}</Text>
                  {light.gatewayName ? <Text style={styles.muted}>{light.gatewayName}</Text> : null}
                </View>
                <Switch
                  accessibilityLabel={`Include ${light.poleNumber} in this action`}
                  value={!excluded.has(light.productName)}
                  onValueChange={() => toggle(light.productName)}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Button
        label={lightButtonLabel({ submitting, cooldownRemaining: cooldown, brightness })}
        variant={brightness === 0 ? "secondary" : "primary"}
        disabled={submitting || cooldown > 0 || !command.ok || included.length === 0}
        onPress={() => void submit()}
      />
      {result ? <Banner tone={result.ok ? "success" : "error"} message={result.message} /> : null}

      {confirm === "confirming" ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.accentStrong} />
          <Text style={styles.muted}>
            Confirming the {plural ? `${checking.length} lights are` : "light is"} {expected.toUpperCase()}…
          </Text>
        </View>
      ) : null}
      {confirm === "confirmed" ? (
        <Banner
          tone="success"
          message={`Confirmed: ${plural ? `all ${checking.length} lights are` : "the light is"} ${expected.toUpperCase()}.`}
        />
      ) : null}
      {confirm === "unconfirmed" ? (
        <View style={styles.gap}>
          <Banner
            tone="warning"
            message={`Didn't confirm — the ${plural ? "lights" : "light"} may not have changed yet.`}
          />
          <Button label="Check again" variant="secondary" onPress={() => startConfirming(expected, checking)} />
        </View>
      ) : null}

      {onCancel ? <Button label="Cancel" variant="secondary" onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  label: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  muted: { fontSize: 12.5, color: colors.inkMuted },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  gap: { gap: space.sm },
  flex: { flex: 1 },
  affected: { gap: space.xs },
  affectedList: { maxHeight: 240, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  affectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pole: { fontSize: 14, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
});
