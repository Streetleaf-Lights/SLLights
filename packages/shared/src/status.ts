/**
 * Status label -> tone, mirroring the web's connectedTextClassName /
 * overallStatusTextClassName (apps/web/src/lib/text.ts). Tones are
 * colour-neutral so each app maps them to its own palette.
 */
export type StatusTone = "active" | "flagged" | "muted" | "faint";

export function connectedTone(label: string | null | undefined): StatusTone {
  switch (label) {
    case "Online":
      return "active";
    case "Offline":
    case "Disconnected":
      return "flagged";
    default:
      return "faint";
  }
}

export function overallStatusTone(label: string | null | undefined): StatusTone {
  switch (label) {
    case "OK":
      return "active";
    case "Fault":
      return "flagged";
    case "Not Reporting":
    case "Not Reporting 48H":
      return "muted";
    default:
      return "faint";
  }
}
