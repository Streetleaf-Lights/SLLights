import { parseApimDate } from "./dates";

/**
 * Display formatting with no styling attached — safe for both the web app
 * (which layers Tailwind classNames on top, see apps/web/src/lib/text.ts)
 * and the mobile app.
 */

/** First letter of the first two words, uppercased (e.g. "Coastal Power" -> "CP"). */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Formats a percentage to at most 1 decimal place, trimming a trailing ".0" (89.77 -> "89.8%", 100.0 -> "100%"). Returns "—" if the value is missing. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Number(value.toFixed(1))}%`;
}

/**
 * Strips a trailing timezone offset (or "Z") from a timestamp for a cleaner
 * display: "2026-07-26 13:25:41+00:00" -> "2026-07-26 13:25:41". Returns
 * "—" for null (no telemetry available).
 */
export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  const withoutOffset = value.replace(/(?:[+-]\d{2}:\d{2}|Z)$/, "").trim();
  // Only show up to minutes — drops seconds and any fractional seconds
  // (e.g. "2026-08-24 14:07:15" or "...14:07:15.524542" -> "...14:07").
  // A no-op if the value already has no seconds part.
  return withoutOffset.replace(/(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/, "$1");
}

/**
 * A "silent" pole is one whose lastUpdate is more than 48 hours old (or
 * missing entirely) — its "48h" stats are stale, describing whatever it
 * last reported rather than its current state, so callers should label
 * them as "Last Known" rather than presenting them as live.
 *
 * Parses through parseApimDate, so the space-before-offset format
 * ("... 16:46:16.000 -04:00") is read correctly instead of becoming NaN
 * and every such pole being treated as silent.
 */
export function isSilentPole(lastUpdate: string | null | undefined, nowMs: number = Date.now()): boolean {
  const parsed = parseApimDate(lastUpdate);
  if (Number.isNaN(parsed)) return true;
  const hoursSinceUpdate = (nowMs - parsed) / (1000 * 60 * 60);
  return hoursSinceUpdate > 48;
}

/**
 * Panel status text using the API's pre-computed panelStatusText
 * directly. Appends the idle reason in parentheses when actually Idle,
 * since that's additional context from a separate field.
 */
export function panelLabelText(pole: {
  panelStatusText: string | null;
  panelIdleReason: string | null;
}): string {
  const label = pole.panelStatusText ?? "—";
  if (label === "Idle" && pole.panelIdleReason) {
    return `${label} (${pole.panelIdleReason})`;
  }
  return label;
}
