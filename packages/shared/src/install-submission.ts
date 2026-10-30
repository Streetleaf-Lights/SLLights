/**
 * A field install, as the mobile Scan tab captures it — saved on the phone
 * first and sent when there's a connection (possibly much later), so it
 * carries its own id and capture time.
 */
/**
 * The gateway a pole is installed for (Leadsun group): its code, group name,
 * and Leadsun group id — what the coming "add pole to gateway" API needs.
 */
export interface InstallGateway {
  code: string;
  name: string;
  groupId: number | null;
}

export interface InstallSubmission {
  /** Created on the phone; lets the server ignore a resend of the same install. */
  id: string;
  /** The project the pole belongs to (chosen in the form's first dropdown). */
  projectId: string;
  /** The gateway it's installed for (chosen in Box 2) — required. */
  gateway: InstallGateway;
  lightHeadSerial: string;
  solarPanelSerial: string;
  /** The pole's sticker number (chosen in the form's second dropdown). */
  poleNumber: string;
  latitude: number;
  longitude: number;
  /** The GPS accuracy radius, when the phone reports one. */
  accuracyMeters: number | null;
  /** When the crew submitted it on the phone (ISO-8601) — not when it reached the server. */
  capturedAt: string;
  notes: string | null;
}

export const SERIAL_MAX_LENGTH = 64;
export const POLE_NUMBER_MAX_LENGTH = 40;
export const INSTALL_NOTES_MAX_LENGTH = 500;

/** What the form holds before an id and capture time are added. */
export interface InstallDraft {
  projectId: string;
  gateway: InstallGateway | null;
  lightHeadSerial: string;
  solarPanelSerial: string;
  poleNumber: string;
  location: { latitude: number; longitude: number; accuracyMeters: number | null } | null;
  notes: string;
}

export type InstallFieldErrors = Partial<
  Record<"projectId" | "gateway" | "lightHeadSerial" | "solarPanelSerial" | "poleNumber" | "location" | "notes", string>
>;

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

/**
 * Checks a draft and shapes it for sending. Everything is required except
 * Notes: the project, both serials (trimmed), the pole number — the chosen
 * sticker — (trimmed, upper-cased) and a usable location; notes are optional (blank → null). Returns
 * per-field errors otherwise.
 */
export function validateInstallDraft(
  draft: InstallDraft,
): { ok: true; value: Omit<InstallSubmission, "id" | "capturedAt"> } | { ok: false; errors: InstallFieldErrors } {
  const errors: InstallFieldErrors = {};
  const lightHeadSerial = draft.lightHeadSerial.trim();
  const solarPanelSerial = draft.solarPanelSerial.trim();
  const poleNumber = draft.poleNumber.trim().toUpperCase();
  const projectId = draft.projectId.trim();

  if (!projectId) errors.projectId = "Select a project.";
  const gateway = draft.gateway && draft.gateway.code.trim() ? draft.gateway : null;
  if (!gateway) errors.gateway = "Select a gateway.";
  if (!lightHeadSerial) errors.lightHeadSerial = "Light Head Serial Number is required.";
  else if (lightHeadSerial.length > SERIAL_MAX_LENGTH) errors.lightHeadSerial = `Serial numbers are at most ${SERIAL_MAX_LENGTH} characters.`;
  if (!solarPanelSerial) errors.solarPanelSerial = "Solar Panel Serial Number is required.";
  else if (solarPanelSerial.length > SERIAL_MAX_LENGTH) errors.solarPanelSerial = `Serial numbers are at most ${SERIAL_MAX_LENGTH} characters.`;
  if (!poleNumber) errors.poleNumber = "Select a sticker (pole number).";
  else if (poleNumber.length > POLE_NUMBER_MAX_LENGTH) errors.poleNumber = `Pole Number must be at most ${POLE_NUMBER_MAX_LENGTH} characters.`;

  const location = draft.location;
  const usableLocation =
    location !== null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180;
  if (!usableLocation) errors.location = "Location is required. Get the location before submitting.";

  if (draft.notes.length > INSTALL_NOTES_MAX_LENGTH) errors.notes = `Notes must be at most ${INSTALL_NOTES_MAX_LENGTH} characters.`;
  if (Object.keys(errors).length > 0 || !usableLocation || !gateway) return { ok: false, errors };

  return {
    ok: true,
    value: {
      projectId,
      gateway: { code: gateway.code.trim(), name: gateway.name.trim(), groupId: gateway.groupId },
      lightHeadSerial,
      solarPanelSerial,
      poleNumber,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracyMeters: location.accuracyMeters,
      notes: blankToNull(draft.notes),
    },
  };
}

/**
 * Server-side check of a submitted install (untrusted): the same rules as
 * the form — everything required except notes — plus the id and capture
 * time the phone adds. Returns the cleaned install, or what's wrong.
 */
export function validateInstallSubmission(body: unknown): { ok: true; value: InstallSubmission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Malformed request body." };
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (!str(b.id).trim()) return { ok: false, error: "An install id is required." };
  const capturedAt = str(b.capturedAt);
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return { ok: false, error: "capturedAt must be a date-time." };
  if (b.notes !== undefined && b.notes !== null && typeof b.notes !== "string") return { ok: false, error: "notes must be text." };
  const lat = b.latitude;
  const long = b.longitude;
  const g = b.gateway && typeof b.gateway === "object" ? (b.gateway as Record<string, unknown>) : null;
  const gateway: InstallGateway | null =
    g && typeof g.code === "string"
      ? {
          code: g.code,
          name: typeof g.name === "string" ? g.name : g.code,
          groupId: typeof g.groupId === "number" && Number.isFinite(g.groupId) ? g.groupId : null,
        }
      : null;
  const checked = validateInstallDraft({
    projectId: str(b.projectId),
    gateway,
    lightHeadSerial: str(b.lightHeadSerial),
    solarPanelSerial: str(b.solarPanelSerial),
    poleNumber: str(b.poleNumber),
    location:
      typeof lat === "number" && typeof long === "number"
        ? { latitude: lat, longitude: long, accuracyMeters: typeof b.accuracyMeters === "number" ? b.accuracyMeters : null }
        : null,
    notes: str(b.notes),
  });
  if (!checked.ok) return { ok: false, error: Object.values(checked.errors)[0] ?? "Invalid install." };
  return { ok: true, value: { ...checked.value, id: str(b.id).trim(), capturedAt } };
}
