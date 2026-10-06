import { decodeJwtPayload } from "./jwt";
import type { SessionUser } from "./types";

/**
 * Decodes the JWT payload from a session token — deliberately no signature
 * verification, since we're not the one issuing/signing these tokens
 * (APIM is), and adding real verification would mean duplicating its
 * signing secret here. This is used for:
 *  - display decisions (web sidebar links, the Invite User button; mobile
 *    tabs and screens)
 *  - route enforcement in the web app's proxy.ts and its API route
 *    handlers (blocking /customers for a Customer Admin, scoping
 *    /customers/{id} and mobile lookups to their own id)
 *
 * A tampered/forged token would still fail every APIM call that validates
 * the Bearer token itself — so at worst a forged token could change what
 * the app *shows or navigates to*, not what data it can read or write,
 * PROVIDED every APIM operation reached with it validates the JWT.
 *
 * Runtime-agnostic (no Buffer, no next/headers), so it's safe to import
 * from Next.js server code, client components, and React Native alike.
 */
export function decodeSessionToken(token: string): SessionUser | null {
  const payload = decodeJwtPayload(token);
  if (typeof payload?.sub !== "string" || typeof payload?.role !== "string") return null;

  return {
    id: payload.sub,
    role: payload.role,
    customerId: normalizeCustomerId(payload.customerId),
  };
}

const EMPTY_GUID = /^0{8}-0{4}-0{4}-0{4}-0{12}$/;

/**
 * "No customer" can arrive as a missing claim, null, an empty string, or an
 * all-zero GUID (token issuers often can't emit null claims). All mean the
 * same thing — a Streetleaf user — and must become null, or isCustomerScoped
 * would treat a Streetleaf User as belonging to a customer.
 */
function normalizeCustomerId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || EMPTY_GUID.test(trimmed) ? null : trimmed;
}

/**
 * True for anyone scoped to exactly one customer's data: a Customer
 * Admin, a Customer Owner, or a "Customer User" (a plain "User" role that
 * does belong to a customer). False for anyone with full cross-customer
 * visibility: a Streetleaf Admin, or a "Streetleaf User" (a plain "User"
 * with no customer). Single source of truth for data scoping across the
 * web app (sidebar, proxy.ts, page data scoping) and the mobile app —
 * kept here so those can't drift out of sync with each other.
 */
export function isCustomerScoped(
  role: string | null | undefined,
  customerId: string | null | undefined,
): boolean {
  return (
    role === "Customer Admin" ||
    role === "Customer Owner" ||
    (role === "User" && customerId != null)
  );
}

/**
 * Seconds remaining until the JWT's own `exp` claim. The web app sizes its
 * session cookie's maxAge from this; the mobile app uses it to treat a
 * stored token as signed-out once it has expired. Returns null if the token
 * can't be decoded or has no exp claim, so the caller can fall back to a
 * default.
 */
export function getSecondsUntilExpiry(token: string, nowMs: number = Date.now()): number | null {
  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp !== "number") return null;

  const secondsRemaining = payload.exp - Math.floor(nowMs / 1000);
  return secondsRemaining > 0 ? secondsRemaining : 0;
}

/**
 * Roles allowed to use field tools — the mobile Scan tab and install
 * recording. An explicit list rather than "anyone without a customer":
 * plain Users (Streetleaf or customer) don't get field tools.
 * "Streetleaf Crew" must match the role name APIM issues exactly.
 */
export const FIELD_TOOL_ROLES: readonly string[] = ["Streetleaf Admin", "Streetleaf Crew"];

export function canUseFieldTools(role: string | null | undefined): boolean {
  return role != null && FIELD_TOOL_ROLES.includes(role);
}
