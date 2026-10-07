import { parseApimDate } from "./dates";
import { formatPercent, panelLabelText } from "./format";
import type { StatusTone } from "./status";
import type { PoleVital } from "./types";

/**
 * The pole page's display rules, shared by the web pole page and the mobile
 * pole screen (whose server route also uses them to send customer-scoped
 * viewers only what the web would show them). Colour-neutral: each app maps
 * StatusTone to its own palette.
 */

export interface ToneText {
  text: string;
  tone: StatusTone;
}

export const formatCoordinate = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : String(value);
export const formatVoltage = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value}V`;
export const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : String(value);

/**
 * Green "Online" when true, red "Offline" when false. When isOnline is
 * null: "Disconnected" if the pole has reported before (lastUpdate
 * present), "Unknown" if it never has.
 */
export function connectionStatusTone(
  isOnline: boolean | null | undefined,
  lastUpdate: string | null | undefined,
): ToneText {
  if (isOnline === null || isOnline === undefined) {
    return lastUpdate === null || lastUpdate === undefined
      ? { text: "Unknown", tone: "faint" }
      : { text: "Disconnected", tone: "flagged" };
  }
  return isOnline ? { text: "Online", tone: "active" } : { text: "Offline", tone: "flagged" };
}

/** Green okLabel when false, red faultLabel when true, neutral dash when null/undefined. */
export function faultStatusTone(isFault: boolean | null | undefined, okLabel: string, faultLabel: string): ToneText {
  if (isFault === null || isFault === undefined) return { text: "—", tone: "faint" };
  return isFault ? { text: faultLabel, tone: "flagged" } : { text: okLabel, tone: "active" };
}

// US mainland zone abbreviations by UTC offset, split by whether daylight
// saving is in effect (the same offset is a different zone in each).
const STANDARD_TIME_ZONES: Record<number, string> = { "-5": "EST", "-6": "CST", "-7": "MST", "-8": "PST" };
const DAYLIGHT_TIME_ZONES: Record<number, string> = { "-4": "EDT", "-5": "CDT", "-6": "MDT", "-7": "PDT" };

/** UTC timestamp (ms) of the nth Sunday of a month (1-indexed). */
function nthSundayOfMonth(year: number, month: number, n: number): number {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  const firstDayOfWeek = new Date(firstOfMonth).getUTCDay();
  const firstSundayDate = firstDayOfWeek === 0 ? 1 : 1 + (7 - firstDayOfWeek);
  return Date.UTC(year, month - 1, firstSundayDate + (n - 1) * 7);
}

/** US daylight saving: 2nd Sunday of March through 1st Sunday of November. */
function isUsDaylightSaving(year: number, month: number, day: number): boolean {
  const current = Date.UTC(year, month - 1, day);
  return current >= nthSundayOfMonth(year, 3, 2) && current < nthSundayOfMonth(year, 11, 1);
}

/**
 * "Expected ON @ 19:54 EDT" from a sunsetTime like
 * "2026-08-28 19:54:31.130526-04:00" — hour/minute and offset read
 * literally from the string, the offset resolved to a US zone abbreviation
 * (DST-aware); "UTC±H" for other offsets; null if unparseable.
 */
export function formatSunsetExpectation(sunsetTime: string | null | undefined): string | null {
  if (!sunsetTime) return null;
  const match = sunsetTime.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):\d{2}(?:\.\d+)?([+-]\d{2}):?\d{2}$/,
  );
  if (!match) return null;
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, offsetHourStr] = match;
  const offsetHours = Number(offsetHourStr);
  const isDst = isUsDaylightSaving(Number(yearStr), Number(monthStr), Number(dayStr));
  const zone =
    (isDst ? DAYLIGHT_TIME_ZONES : STANDARD_TIME_ZONES)[offsetHours] ??
    `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`;
  return `Expected ON @ ${hourStr}:${minuteStr} ${zone}`;
}

/**
 * A "provisioned" (single-channel) pole: any of the three channel-2
 * readings is null. Channel 2's metrics are then hidden, and channel 1's
 * labels drop their "1" suffix.
 */
export function isProvisionedPole(
  pole: Pick<PoleVital, "lampPower2" | "batteryElecCurrent2" | "batteryVoltage2">,
): boolean {
  return pole.lampPower2 === null || pole.batteryElecCurrent2 === null || pole.batteryVoltage2 === null;
}

export interface PoleMetric {
  label: string;
  value: string;
  /** A note shown under the row (the Light card's "Expected ON @ …"). */
  note?: string | null;
}

export interface PoleStatusCard {
  id: "light" | "panel" | "battery" | "issues";
  title: string;
  status: ToneText;
  metrics: PoleMetric[];
}

/**
 * The four Statuses cards exactly as the web pole page shows them, for a
 * staff viewer or a customer-scoped one:
 *  - Light/Panel/Battery fault status, dashed when connectivity is Unknown
 *    (no reliable telemetry basis), as are the 48H Average % metrics;
 *  - Issue Entry from isOpenIssueFault as-is (not derived telemetry);
 *  - customer-scoped viewers get Operating Status only (+ Battery %);
 *  - single-channel poles hide channel 2 and drop the "1" suffixes.
 */
export function buildPoleStatusCards(pole: PoleVital, viewerScoped: boolean): PoleStatusCard[] {
  const unknown = connectionStatusTone(pole.isOnline, pole.lastUpdate).text === "Unknown";
  const cardStatus = (isFault: boolean | null | undefined, ok: string, fault: string) =>
    faultStatusTone(unknown ? null : isFault, ok, fault);
  const avg = (value: number | null | undefined) => (unknown ? "—" : formatPercent(value));
  const single = isProvisionedPole(pole);

  const light: PoleStatusCard = {
    id: "light",
    title: "Light",
    status: cardStatus(pole.isLedFault, "OK", "Fault"),
    metrics: [
      {
        label: "Operating Status",
        value: pole.lightStatusText ?? "—",
        note: pole.lightStatusText === "OFF" ? formatSunsetExpectation(pole.sunsetTime) : null,
      },
      ...(viewerScoped
        ? []
        : [
            { label: "48H Average Light %", value: avg(pole.avgLightPercentage) },
            { label: single ? "Light Power" : "Light Power 1", value: formatNumber(pole.lampPower1) },
            ...(single ? [] : [{ label: "Light Power 2", value: formatNumber(pole.lampPower2) }]),
          ]),
    ],
  };

  const panel: PoleStatusCard = {
    id: "panel",
    title: "Panel",
    status: cardStatus(pole.isPanelFault, "OK", "Fault"),
    metrics: [
      { label: "Operating Status", value: panelLabelText(pole) },
      ...(viewerScoped
        ? []
        : [
            { label: "48H Average Panel %", value: avg(pole.avgPanelPercentage) },
            { label: "Panel Voltage", value: formatVoltage(pole.solarBoardVoltage) },
            { label: "Panel Electric Current", value: formatNumber(pole.solarBoardElecCurrent) },
          ]),
    ],
  };

  const battery: PoleStatusCard = {
    id: "battery",
    title: "Battery",
    status: cardStatus(pole.isBatteryFault, "OK", "Fault"),
    metrics: viewerScoped
      ? [
          { label: "Operating Status", value: pole.batteryStatusText ?? "—" },
          { label: "Battery Percentage", value: formatNumber(pole.electricCurrentAverage) },
        ]
      : [
          { label: "Operating Status", value: pole.batteryStatusText ?? "—" },
          { label: "48H Average Battery %", value: avg(pole.avgBatteryPercentage) },
          { label: "Battery Percentage", value: formatNumber(pole.electricCurrentAverage) },
          { label: single ? "Electric Current" : "Electric Current 1", value: formatNumber(pole.batteryElecCurrent1) },
          ...(single ? [] : [{ label: "Electric Current 2", value: formatNumber(pole.batteryElecCurrent2) }]),
          { label: single ? "Battery Voltage" : "Battery Voltage 1", value: formatVoltage(pole.batteryVoltage1) },
          ...(single ? [] : [{ label: "Battery Voltage 2", value: formatVoltage(pole.batteryVoltage2) }]),
        ],
  };

  const issues: PoleStatusCard = {
    id: "issues",
    title: "Issue Entry",
    // Not dashed for Unknown connectivity: open issues aren't telemetry.
    status: faultStatusTone(pole.isOpenIssueFault, "None", "Yes"),
    metrics: [],
  };

  return [light, panel, battery, issues];
}

/** An issue's status colour, as on the web: red for open, green for closed, neutral otherwise. */
export function issueStatusTone(status: string): StatusTone {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "flagged";
  if (normalized === "closed") return "active";
  return "muted";
}

/** Issues newest first by dateReported (APIM's timestamp format), unparseable dates last. */
export function sortIssuesNewestFirst<T extends { dateReported: string }>(issues: readonly T[]): T[] {
  const time = (issue: T) => {
    const parsed = parseApimDate(issue.dateReported);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };
  return [...issues].sort((a, b) => time(b) - time(a));
}

/**
 * Whether a pole's coordinates can be put on a map: both present, finite and
 * in range. (The web shows a map whenever both are non-null; this also
 * keeps a malformed reading from crashing a native map view.)
 */
export function hasMapLocation(
  lat: number | null | undefined,
  long: number | null | undefined,
): boolean {
  return (
    typeof lat === "number" &&
    typeof long === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(long) &&
    Math.abs(lat) <= 90 &&
    Math.abs(long) <= 180
  );
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** About the web map's zoom 16 (street level) — used for a single point, and as the closest zoom for several. */
export const STREET_LEVEL_DELTA = 0.004;

/**
 * The map region that shows every point, like the web map's fitBounds: the
 * box around them plus a margin so edge markers aren't clipped, never
 * tighter than street level. A single point (or several in the same spot)
 * centres at street level. Points without usable coordinates are ignored;
 * null when none are left.
 */
export function mapRegionForPoints(points: readonly { lat: number | null; long: number | null }[]): MapRegion | null {
  const usable = points.filter((p) => hasMapLocation(p.lat, p.long)) as { lat: number; long: number }[];
  if (usable.length === 0) return null;
  const lats = usable.map((p) => p.lat);
  const longs = usable.map((p) => p.long);
  const [minLat, maxLat, minLong, maxLong] = [Math.min(...lats), Math.max(...lats), Math.min(...longs), Math.max(...longs)];
  const MARGIN = 1.4; // 20% padding on each side
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLong + maxLong) / 2,
    latitudeDelta: Math.max(STREET_LEVEL_DELTA, (maxLat - minLat) * MARGIN),
    longitudeDelta: Math.max(STREET_LEVEL_DELTA, (maxLong - minLong) * MARGIN),
  };
}
