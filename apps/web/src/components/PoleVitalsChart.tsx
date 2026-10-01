"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PeriodType, PoleVitalPeriod } from "@/lib/types";

const DAY_OPTIONS = [1, 2, 7, 14, 30];
const DEFAULT_DAYS = 2;

// The chart is always Hourly now (periodType=Hour) — the dropdown below
// only controls how many days of hourly points to fetch, via `limit`
// (days * 24, e.g. 7 days -> limit=168) — there's no separate cap, so the
// larger options (7/14/30 days) get their full uncapped count of vitals,
// not truncated down to whatever the 1/2-day options request.

// Recharts' default <Legend> otherwise sorts entries alphabetically by
// dataKey ("battery" < "light" < "panel") regardless of <Line> JSX order —
// this fixed list drives a custom legend renderer instead, so it always
// shows Light, Panel, Battery.
const LEGEND_ORDER: { value: string; color: string }[] = [
  { value: "Light %", color: "var(--status-active)" },
  { value: "Panel %", color: "var(--status-warning)" },
  { value: "Battery %", color: "var(--accent)" },
];

/**
 * Parses the wall-clock date/time as authored in the string, ignoring its
 * embedded UTC offset — matching formatTimestamp's convention elsewhere in
 * this app of displaying API timestamps literally rather than converting
 * them to the viewer's own browser timezone. That matters here specifically
 * because Date's local getters (getHours, toLocaleTimeString with no
 * explicit timeZone) reinterpret the instant in the *viewer's* timezone —
 * so "00:00:00-04:00" would only read as hour 0 for a viewer who happens
 * to also be in -04:00; anyone else would see the "day boundary" label
 * appear at the wrong hour, or not at midnight at all.
 */
function parseWallClock(periodStart: string): Date | null {
  const match = periodStart.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}

/**
 * "2026-07-30 11:00:00-04:00" -> "11 AM" (Hour) or "Jul 30" (Day).
 *
 * For Hourly, the date is shown specifically at the midnight (12 AM) point
 * — the day boundary — and just the hour otherwise; the reader identifies
 * which day a given hour belongs to via the nearest earlier date landmark,
 * the same convention most time-series chart libraries use. This means
 * the same display text (e.g. "7 PM") legitimately repeats once per day —
 * see the dataKey/tickFormatter split in the component below for why that
 * no longer risks mismatched tooltips the way it would if this formatted
 * string were used as the axis's own unique key.
 */
export function formatPeriodLabel(periodStart: string | null | undefined, periodType: PeriodType): string {
  if (!periodStart) return "—";
  const date = parseWallClock(periodStart);
  if (!date) return periodStart;
  if (periodType === "Day") {
    return date.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return date.getUTCHours() === 0
    ? date.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })
    : date.toLocaleTimeString([], { hour: "numeric", timeZone: "UTC" });
}

/**
 * "2026-07-30 11:00:00-04:00" -> "Jul 30, 11 AM" (Hour) or "Jul 30" (Day).
 *
 * Unlike formatPeriodLabel's axis-tick text (which only shows the date at
 * the midnight/day-boundary point, to avoid crowding every tick), the
 * tooltip always includes the date — there's only ever one tooltip visible
 * at a time, so there's no crowding concern, and always showing the date
 * removes any need to trace back to the nearest earlier midnight tick to
 * know which day a given hour belongs to.
 */
export function formatTooltipLabel(
  periodStart: string | null | undefined,
  periodType: PeriodType,
): string {
  if (!periodStart) return "—";
  const date = parseWallClock(periodStart);
  if (!date) return periodStart;
  const dateText = date.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
  if (periodType === "Day") return dateText;
  const timeText = date.toLocaleTimeString([], { hour: "numeric", timeZone: "UTC" });
  return `${dateText}, ${timeText}`;
}

/**
 * Resolves an X-axis tick's label by looking up its underlying data point.
 *
 * Recharts calls tickFormatter as (entry.value, i) — `dataPointIndex`
 * (first arg) is this tick's actual data value, i.e. our chartData row's
 * "index" field. The second arg Recharts provides is the tick's position
 * within Recharts' own ticks array, which gets thinned down when there
 * isn't room to label every point — NOT an index into chartData — so it
 * must never be used to look chartData up; doing so once caused every
 * label to point at the wrong data point whenever ticks got thinned.
 */
export function formatTickLabel(
  chartData: { periodStart: string | null | undefined }[],
  dataPointIndex: number,
  periodType: PeriodType,
): string {
  return formatPeriodLabel(chartData[dataPointIndex]?.periodStart, periodType);
}

function ChartMessage({ tone, children }: { tone: "muted" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`flex h-64 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-center text-[12.5px] ${
        tone === "error" ? "text-[var(--status-flagged)]" : "text-[var(--ink-faint)]"
      }`}
    >
      {children}
    </div>
  );
}

export function PoleVitalsChart({ poleId }: { poleId: string }) {
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [vitals, setVitals] = useState<PoleVitalPeriod[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const limit = days * 24;

    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return fetch(
          `/api/getpolevitalsbyperiod?poleId=${encodeURIComponent(poleId)}&periodType=Hour&limit=${limit}`,
        );
      })
      .then(async (res) => {
        if (cancelled || !res) return;
        const body = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok) {
          setError(body?.error ?? "Failed to load pole vitals.");
          setVitals(null);
          return;
        }
        setVitals(body?.vitals ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
          setVitals(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [poleId, days]);

  // Sort chronologically regardless of the order the API returns them in,
  // so the chart always reads left-to-right oldest-to-newest. A missing
  // periodStart (seen elsewhere in this API as an omitted-rather-than-null
  // field) sorts as if it were the epoch rather than crashing.
  //
  // `index` (not the formatted label) is the axis's dataKey. Recharts
  // matches hovered/rendered points back to axis ticks by this dataKey's
  // *value* in some code paths — if that value is pre-formatted display
  // text like "7 PM", two points sharing that text (e.g. two different
  // days, or the new "hour-only except at midnight" labeling below) can
  // resolve to the wrong point's tick/coordinate. An index is always
  // unique, so this can't happen; the actual display text is produced
  // separately via tickFormatter/labelFormatter below.
  const chartData = (vitals ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.periodStart ?? 0).getTime() - new Date(b.periodStart ?? 0).getTime(),
    )
    .map((vital, index) => ({
      index,
      periodStart: vital.periodStart,
      light: vital.avgLightPercentage,
      panel: vital.avgPanelPercentage,
      battery: vital.avgBatteryPercentage,
    }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1.5">
        <label htmlFor="vitals-days" className="text-[12px] text-[var(--ink-muted)]">
          Show
        </label>
        <select
          id="vitals-days"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)]"
        >
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} {d === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ChartMessage tone="muted">Loading…</ChartMessage>
      ) : error ? (
        <ChartMessage tone="error">{error}</ChartMessage>
      ) : chartData.length === 0 ? (
        <ChartMessage tone="muted">No vitals history available for this pole.</ChartMessage>
      ) : (
        <div className="h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="index"
                tickFormatter={(value) => formatTickLabel(chartData, value, "Hour")}
                tick={{ fontSize: 11 }}
                stroke="var(--ink-faint)"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--ink-faint)" width={36} />
              <Tooltip
                labelFormatter={(_value, payload) =>
                  formatTooltipLabel(payload?.[0]?.payload?.periodStart, "Hour")
                }
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border)" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                content={() => (
                  <ul className="m-0 flex list-none justify-center gap-4 p-0">
                    {LEGEND_ORDER.map((entry) => (
                      <li key={entry.value} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                          aria-hidden="true"
                        />
                        <span style={{ color: entry.color }}>{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
              />
              {/*
                No connectNulls on any of these three — a pole can go
                hours (or longer) with no vitals at all for a given period
                (isOnline/every fault flag/every average all null
                together), and connectNulls would draw a straight line
                across that entire gap as if it were real, interpolated
                data, silently hiding that the pole wasn't reporting.
                Leaving it off means Recharts breaks the line for any
                stretch of null points, which is the honest picture.
              */}
              <Line
                type="monotone"
                dataKey="light"
                name="Light %"
                stroke="var(--status-active)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="panel"
                name="Panel %"
                stroke="var(--status-warning)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="battery"
                name="Battery %"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
