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

/**
 * What a project-level command switches — the web modal's three scopes:
 * the whole project ("Project Control"), one gateway ("Gateway Control"),
 * or chosen lights (a single light's "Control", or a project/gateway
 * command with some poles deselected). Lights are named by Leadsun
 * ProductName, as the web sends them.
 */
export type ProjectLightTarget =
  | { kind: "project" }
  | { kind: "gateway"; gatewayCode: string }
  | { kind: "lights"; productNames: string[] };

export interface ProjectLightCommand extends LightCommand {
  target: ProjectLightTarget;
}

/**
 * Shape check for an untrusted project command (brightness/time as for a
 * single pole, plus one well-formed target). The server must still check
 * that the gateway/lights belong to the project — this only checks shape.
 */
export function validateProjectLightCommand(
  body: unknown,
): { ok: true; value: ProjectLightCommand } | { ok: false; error: string } {
  const base = validateLightCommand(body);
  if (!base.ok) return base;
  const target = (body as { target?: unknown }).target as Record<string, unknown> | undefined;
  if (!target || typeof target !== "object") return { ok: false, error: "A target is required." };

  if (target.kind === "project") return { ok: true, value: { ...base.value, target: { kind: "project" } } };
  if (target.kind === "gateway") {
    if (typeof target.gatewayCode !== "string" || !target.gatewayCode.trim()) {
      return { ok: false, error: "gatewayCode is required." };
    }
    return { ok: true, value: { ...base.value, target: { kind: "gateway", gatewayCode: target.gatewayCode } } };
  }
  if (target.kind === "lights") {
    const names = target.productNames;
    if (!Array.isArray(names) || names.length === 0 || !names.every((n) => typeof n === "string" && n.trim())) {
      return { ok: false, error: "productNames must be a non-empty list." };
    }
    return { ok: true, value: { ...base.value, target: { kind: "lights", productNames: [...new Set(names as string[])] } } };
  }
  return { ok: false, error: "Unknown target." };
}
