// Styling-free formatting (initials, formatPercent, formatTimestamp,
// isSilentPole, panelLabelText) now lives in @sllights/shared so the mobile
// app formats values identically. The className helpers below are
// Tailwind-specific and stay web-only.
export {
  formatPercent,
  formatTimestamp,
  initials,
  isSilentPole,
  panelLabelText,
} from "@sllights/shared/format";

/**
 * Green "Online" when true, red "Offline" when false. When isOnline is
 * null, the pole has no current online-status reading — whether that
 * means it's actually disconnected or we just don't know depends on
 * whether it has ever reported in at all: "Disconnected" if lastUpdate is
 * present (it has reported before, just not its online status), "Unknown"
 * if lastUpdate is also null (no telemetry of any kind exists yet).
 */
export function connectionStatus(
  isOnline: boolean | null | undefined,
  lastUpdate: string | null | undefined,
): { text: string; className: string } {
  if (isOnline === null || isOnline === undefined) {
    return lastUpdate === null || lastUpdate === undefined
      ? { text: "Unknown", className: "text-[var(--ink-faint)]" }
      : { text: "Disconnected", className: "text-[var(--status-flagged)]" };
  }
  return {
    text: isOnline ? "Online" : "Offline",
    className: isOnline ? "text-[var(--status-active)]" : "text-[var(--status-flagged)]",
  };
}


/**
 * Color for the API's pre-computed "48h Connected" label (connectedText)
 * — same color scheme connectionStatus() above used when this was
 * computed client-side from isOnline/lastUpdate, just keyed by the label
 * text instead, since the raw fields aren't needed anymore.
 */
export function connectedTextClassName(label: string | null | undefined): string {
  switch (label) {
    case "Online":
      return "text-[var(--status-active)]";
    case "Offline":
    case "Disconnected":
      return "text-[var(--status-flagged)]";
    default:
      return "text-[var(--ink-faint)]"; // "Unknown", null, or anything unrecognized
  }
}

/**
 * Color for the API's pre-computed "48h Overall Status" label
 * (overallStatusText) — same color scheme the old client-side OK/Fault
 * computation used, extended to also cover the "Not Reporting"/"Not
 * Reporting 48H" values this label can now carry (matching Light/Panel/
 * Battery's own status labels), which the old client-side computation
 * never produced.
 */
export function overallStatusTextClassName(label: string | null | undefined): string {
  switch (label) {
    case "OK":
      return "text-[var(--status-active)]";
    case "Fault":
      return "text-[var(--status-flagged)]";
    case "Not Reporting":
    case "Not Reporting 48H":
      // Same dark-gray tone as the header's other values (Last Update,
      // Install Date, etc.) — distinct from --ink-faint below, which is
      // for values with no real answer at all (a dash, an unrecognized
      // label), not "reporting stopped" which is a known, meaningful state.
      return "text-[var(--ink-muted)]";
    default:
      return "text-[var(--ink-faint)]"; // "—", null, "Unknown"-ish, or anything else unrecognized
  }
}

/**
 * Bold for "OK"/"Fault" — matching the pole detail header's own status
 * cards (Light/Panel/Battery/Issue Entry), which are always bold. Not
 * bold for "Not Reporting"/"Not Reporting 48H"/a dash/anything else,
 * which read as informational notes rather than a definitive status.
 */
export function overallStatusTextWeightClassName(label: string | null | undefined): string {
  return label === "OK" || label === "Fault" ? "font-semibold" : "";
}
