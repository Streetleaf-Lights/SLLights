import type { ColorToken } from "./theme";
import type { PoleVitalPeriod } from "./types";

/**
 * The pole page's Vitals History chart, as the web draws it: hourly points
 * for the last 1/2/7/14/30 days (default 2), three series in a fixed order
 * on a 0–100 scale, gaps left as gaps. Pure helpers shared by the mobile
 * chart (the web's Recharts component keeps its own equivalents).
 */

export const VITALS_DAY_OPTIONS = [1, 2, 7, 14, 30] as const;
export type VitalsDays = (typeof VITALS_DAY_OPTIONS)[number];
export const DEFAULT_VITALS_DAYS: VitalsDays = 2;

export function isVitalsDays(value: number): value is VitalsDays {
  return (VITALS_DAY_OPTIONS as readonly number[]).includes(value);
}

/** Hourly points for `days` days — the web's `limit` (e.g. 7 days -> 168). */
export const vitalsLimitForDays = (days: VitalsDays) => days * 24;

export type VitalsSeriesKey = "light" | "panel" | "battery";

/** Legend and drawing order, as on the web: Light, Panel, Battery. */
export const VITALS_SERIES: readonly { key: VitalsSeriesKey; label: string; color: ColorToken }[] = [
  { key: "light", label: "Light %", color: "statusActive" },
  { key: "panel", label: "Panel %", color: "statusWarning" },
  { key: "battery", label: "Battery %", color: "accent" },
];

export interface VitalsPoint {
  periodStart: string;
  light: number | null;
  panel: number | null;
  battery: number | null;
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

/**
 * The wall-clock date/time as written in the string, ignoring its UTC
 * offset — the web's convention, so "00:00:00-04:00" is midnight for every
 * viewer rather than shifting into their own timezone. Null if unparseable.
 */
function wallClock(periodStart: string | null | undefined) {
  const match = periodStart?.match(WALL_CLOCK);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return { year, month, day, hour, minute, second };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Built by hand rather than with toLocale*String: Hermes' Intl support
// varies by platform and version, and this must read the same everywhere.
const dateText = (t: { month: number; day: number }) => `${MONTHS[t.month - 1]} ${t.day}`;
const hourText = (t: { hour: number }) => `${t.hour % 12 === 0 ? 12 : t.hour % 12} ${t.hour < 12 ? "AM" : "PM"}`;

/** Axis label: "Jul 30" at midnight (the day boundary), the hour ("11 AM") otherwise. */
export function formatVitalsTick(periodStart: string | null | undefined): string {
  if (!periodStart) return "—";
  const t = wallClock(periodStart);
  if (!t) return periodStart;
  return t.hour === 0 ? dateText(t) : hourText(t);
}

/** Tooltip label: always the date and the hour — "Jul 30, 11 AM". */
export function formatVitalsTooltip(periodStart: string | null | undefined): string {
  if (!periodStart) return "—";
  const t = wallClock(periodStart);
  if (!t) return periodStart;
  return `${dateText(t)}, ${hourText(t)}`;
}

/**
 * Chart points oldest to newest, whatever order APIM returns. Sorted by the
 * wall-clock reading (the same one the labels use); unparseable times sort
 * first, as the web's epoch fallback does.
 */
export function toVitalsPoints(vitals: readonly PoleVitalPeriod[]): VitalsPoint[] {
  const key = (p: PoleVitalPeriod) => {
    const t = wallClock(p.periodStart);
    return t ? Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) : 0;
  };
  return [...vitals]
    .sort((a, b) => key(a) - key(b))
    .map((p) => ({
      periodStart: p.periodStart,
      light: p.avgLightPercentage,
      panel: p.avgPanelPercentage,
      battery: p.avgBatteryPercentage,
    }));
}

/**
 * Consecutive runs of index positions where `values` has a number — the
 * pieces of one series' line. A null ends a run, so a stretch with no
 * vitals is drawn as a gap, never bridged (the web's no-connectNulls rule).
 */
export function lineSegments(values: readonly (number | null)[]): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  values.forEach((value, index) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(index);
    }
  });
  if (current.length) segments.push(current);
  return segments;
}

/** About `count` evenly spaced indices (always including the first and last) for axis labels. */
export function tickIndices(length: number, count = 5): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}
