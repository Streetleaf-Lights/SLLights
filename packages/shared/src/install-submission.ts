/**
 * A field install, as the mobile Scan tab captures it — saved on the phone
 * first and sent when there's a connection (possibly much later), so it
 * carries its own id and capture time.
 */
export interface InstallSubmission {
  /** Created on the phone; lets the server ignore a resend of the same install. */
  id: string;
  lightHeadSerial: string;
  solarPanelSerial: string;
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
  lightHeadSerial: string;
  solarPanelSerial: string;
  poleNumber: string;
  location: { latitude: number; longitude: number; accuracyMeters: number | null } | null;
  notes: string;
}

export type InstallFieldErrors = Partial<
  Record<"lightHeadSerial" | "solarPanelSerial" | "poleNumber" | "location" | "notes", string>
>;

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

/**
 * Checks a draft and shapes it for sending. Everything is required except
 * Notes: both serials (trimmed), the pole number (trimmed, upper-cased)
 * and a usable location; notes are optional (blank → null). Returns
 * per-field errors otherwise.
 */
export function validateInstallDraft(
  draft: InstallDraft,
): { ok: true; value: Omit<InstallSubmission, "id" | "capturedAt"> } | { ok: false; errors: InstallFieldErrors } {
  const errors: InstallFieldErrors = {};
  const lightHeadSerial = draft.lightHeadSerial.trim();
  const solarPanelSerial = draft.solarPanelSerial.trim();
  const poleNumber = draft.poleNumber.trim().toUpperCase();

  if (!lightHeadSerial) errors.lightHeadSerial = "Light Head Serial Number is required.";
  else if (lightHeadSerial.length > SERIAL_MAX_LENGTH) errors.lightHeadSerial = `Serial numbers are at most ${SERIAL_MAX_LENGTH} characters.`;
  if (!solarPanelSerial) errors.solarPanelSerial = "Solar Panel Serial Number is required.";
  else if (solarPanelSerial.length > SERIAL_MAX_LENGTH) errors.solarPanelSerial = `Serial numbers are at most ${SERIAL_MAX_LENGTH} characters.`;
  if (!poleNumber) errors.poleNumber = "Pole Number is required.";
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
  if (Object.keys(errors).length > 0 || !usableLocation) return { ok: false, errors };

  return {
    ok: true,
    value: {
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
