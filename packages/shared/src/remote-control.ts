/**
 * Single-pole remote light control, with the web Remote Control modal's
 * limits and timings, shared by the mobile screen and its server route.
 */

export const BRIGHTNESS_MIN = 0;
export const BRIGHTNESS_MAX = 100;
export const DEFAULT_BRIGHTNESS = 50;
export const TIME_MIN_SECONDS = 1;
export const TIME_MAX_SECONDS = 3600;
export const DEFAULT_TIME_SECONDS = 30;

/** Pause between submissions — a guess at Leadsun's own rate limit, as on the web. */
export const COOLDOWN_SECONDS = 10;
/** After a command, poll live status this many times, this far apart, until it matches. */
export const MAX_CONFIRM_ATTEMPTS = 15;
export const CONFIRM_INTERVAL_MS = 1000;

export type LampState = "on" | "off" | "unknown";

export interface LightCommand {
  brightness: number;
  time: number;
}

/**
 * Validates an untrusted light command: brightness a whole number 0–100,
 * time a whole number of seconds 1–3600. Used by the server (the real
 * check) and the app (to disable the button rather than send a bad one).
 */
export function validateLightCommand(
  body: unknown,
): { ok: true; value: LightCommand } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Malformed request body." };
  const { brightness, time } = body as Record<string, unknown>;
  if (
    typeof brightness !== "number" ||
    !Number.isInteger(brightness) ||
    brightness < BRIGHTNESS_MIN ||
    brightness > BRIGHTNESS_MAX
  ) {
    return { ok: false, error: `Brightness must be a whole number from ${BRIGHTNESS_MIN} to ${BRIGHTNESS_MAX}.` };
  }
  if (typeof time !== "number" || !Number.isInteger(time) || time < TIME_MIN_SECONDS || time > TIME_MAX_SECONDS) {
    return { ok: false, error: `Time must be a whole number of seconds from ${TIME_MIN_SECONDS} to ${TIME_MAX_SECONDS}.` };
  }
  return { ok: true, value: { brightness, time } };
}

/** What a successful command should leave the lamp as: ON for any brightness above 0, OFF for 0. */
export const expectedLampState = (brightness: number): Exclude<LampState, "unknown"> =>
  brightness > 0 ? "on" : "off";

/** The web's submit button wording: "Submitting…", "Wait 7s", "TURN OFF" (brightness 0) or "GO!". */
export function lightButtonLabel(state: { submitting: boolean; cooldownRemaining: number; brightness: number }): string {
  if (state.submitting) return "Submitting…";
  if (state.cooldownRemaining > 0) return `Wait ${state.cooldownRemaining}s`;
  return state.brightness === 0 ? "TURN OFF" : "GO!";
}
