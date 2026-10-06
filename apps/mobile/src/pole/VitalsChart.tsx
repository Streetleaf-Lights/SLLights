import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { colors as palette } from "@sllights/shared/theme";
import {
  DEFAULT_VITALS_DAYS,
  formatVitalsTick,
  formatVitalsTooltip,
  lineSegments,
  tickIndices,
  toVitalsPoints,
  VITALS_DAY_OPTIONS,
  VITALS_SERIES,
  type VitalsDays,
  type VitalsPoint,
} from "@sllights/shared/vitals-chart";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/ui/Button";
import { colors, radius, space } from "@/ui/theme";

const HEIGHT = 200;
const PAD = { top: 8, right: 10, bottom: 22, left: 34 };
const Y_TICKS = [0, 25, 50, 75, 100];

/**
 * The pole page's Vitals History, as on the web: hourly Light / Panel /
 * Battery % for the last 1, 2, 7, 14 or 30 days (default 2), 0–100 scale,
 * gaps in reporting left as gaps. Touch (or drag across) the chart to read
 * the values at a point.
 */
export function VitalsChart({ customerId, projectId, poleId }: { customerId: string; projectId: string; poleId: string }) {
  const { api } = useAuth();
  const [days, setDays] = useState<VitalsDays>(DEFAULT_VITALS_DAYS);
  const load = useCallback(
    async () => toVitalsPoints((await api.getPoleVitals(customerId, projectId, poleId, days)).vitals),
    [api, customerId, projectId, poleId, days],
  );
  const { state, retry } = useApiQuery(load);

  return (
    <View style={styles.card}>
      <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel="History length">
        {VITALS_DAY_OPTIONS.map((option) => {
          const selected = option === days;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={`${option} ${option === 1 ? "day" : "days"}`}
              accessibilityState={{ selected }}
              onPress={() => {
                if (selected) return;
                setDays(option);
                retry(); // show the spinner while the new range loads
              }}
              style={[styles.day, selected && styles.daySelected]}
            >
              <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{option}d</Text>
            </Pressable>
          );
        })}
      </View>

      {state.status === "loading" ? (
        <View style={styles.message}>
          <ActivityIndicator accessibilityLabel="Loading vitals history" color={colors.accentStrong} />
        </View>
      ) : state.status === "error" ? (
        <View style={[styles.message, styles.messageGap]}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Button label="Try again" variant="secondary" onPress={retry} />
        </View>
      ) : state.data.length === 0 ? (
        <View style={styles.message}>
          <Text style={styles.mutedText}>No vitals history available for this pole.</Text>
        </View>
      ) : (
        <Plot points={state.data} days={days} />
      )}

      <View style={styles.legend}>
        {VITALS_SERIES.map((series) => (
          <View key={series.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: palette[series.color] }]} />
            <Text style={[styles.legendText, { color: palette[series.color] }]}>{series.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Plot({ points, days }: { points: VitalsPoint[]; days: VitalsDays }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => PAD.left + (points.length > 1 ? i * step : plotW / 2);
  const y = (v: number) => PAD.top + plotH * (1 - Math.min(100, Math.max(0, v)) / 100);

  const pick = (locationX: number) => {
    if (points.length === 0) return;
    const i = points.length > 1 ? Math.round((locationX - PAD.left) / step) : 0;
    setSelected(Math.min(points.length - 1, Math.max(0, i)));
  };

  const point = selected === null ? null : points[selected];
  const ticks = tickIndices(points.length);

  return (
    <View>
      {/* Readout band: values at the touched point, or a hint. */}
      <View style={styles.readout} accessibilityLiveRegion="polite">
        {point ? (
          <>
            <Text style={styles.readoutTime}>{formatVitalsTooltip(point.periodStart)}</Text>
            <View style={styles.readoutValues}>
              {VITALS_SERIES.map((series) => (
                <Text key={series.key} style={[styles.readoutValue, { color: palette[series.color] }]}>
                  {series.label.replace(" %", "")} {point[series.key] === null ? "—" : `${Math.round(point[series.key] as number)}%`}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.mutedText}>Touch the chart to see values.</Text>
        )}
      </View>

      <View
        testID="vitals-plot"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        // Keep the touch while dragging sideways instead of handing it to the page's scroll.
        onResponderTerminationRequest={() => false}
        accessible
        accessibilityLabel={`Vitals history chart, last ${days} ${days === 1 ? "day" : "days"}, ${points.length} hourly points`}
        style={styles.plot}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {Y_TICKS.map((t) => (
              <Line
                key={`grid-${t}`}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={colors.border}
                strokeDasharray="3 3"
              />
            ))}
            {Y_TICKS.map((t) => (
              <SvgText key={`y-${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={10} fill={colors.inkFaint} textAnchor="end">
                {t}
              </SvgText>
            ))}
            {ticks.map((i, n) => (
              <SvgText
                key={`x-${i}`}
                x={x(i)}
                y={HEIGHT - 6}
                fontSize={10}
                fill={colors.inkFaint}
                textAnchor={n === 0 ? "start" : n === ticks.length - 1 ? "end" : "middle"}
              >
                {formatVitalsTick(points[i].periodStart)}
              </SvgText>
            ))}

            {VITALS_SERIES.map((series) =>
              lineSegments(points.map((p) => p[series.key])).map((segment) =>
                segment.length === 1 ? (
                  // A lone reading between gaps: a dot, so it isn't lost.
                  <Circle
                    key={`${series.key}-${segment[0]}`}
                    testID={`segment-${series.key}`}
                    cx={x(segment[0])}
                    cy={y(points[segment[0]][series.key] as number)}
                    r={2}
                    fill={palette[series.color]}
                  />
                ) : (
                  <Polyline
                    key={`${series.key}-${segment[0]}`}
                    testID={`segment-${series.key}`}
                    points={segment.map((i) => `${x(i)},${y(points[i][series.key] as number)}`).join(" ")}
                    fill="none"
                    stroke={palette[series.color]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                ),
              ),
            )}

            {point && selected !== null ? (
              <>
                <Line x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.inkFaint} />
                {VITALS_SERIES.map((series) =>
                  point[series.key] === null ? null : (
                    <Circle
                      key={`sel-${series.key}`}
                      cx={x(selected)}
                      cy={y(point[series.key] as number)}
                      r={4}
                      fill={colors.surface}
                      stroke={palette[series.color]}
                      strokeWidth={2}
                    />
                  ),
                )}
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
  },
  days: { flexDirection: "row", gap: space.xs },
  day: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  dayText: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  dayTextSelected: { color: colors.accentInk },
  message: {
    height: HEIGHT + 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: space.lg,
  },
  messageGap: { gap: space.md },
  mutedText: { fontSize: 13, color: colors.inkFaint, textAlign: "center" },
  errorText: { fontSize: 13, color: colors.statusFlagged, textAlign: "center" },
  readout: { minHeight: 40, justifyContent: "center", gap: 2 },
  readoutTime: { fontSize: 13, fontWeight: "600", color: colors.ink },
  readoutValues: { flexDirection: "row", flexWrap: "wrap", columnGap: space.md },
  readoutValue: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  plot: { height: HEIGHT },
  legend: { flexDirection: "row", justifyContent: "center", gap: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: "500" },
});
