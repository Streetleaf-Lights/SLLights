import type { AuthUser, PoleSummary } from "./types";

/**
 * The contract between the mobile app and the web app's /api/mobile/*
 * route handlers. Both sides import these, so a field rename breaks the
 * typecheck on both rather than failing silently at runtime.
 *
 * Why the mobile app talks to the web app rather than APIM directly:
 *  1. The Ocp-Apim-Subscription-Key must never ship inside an app binary.
 *  2. Some APIM reads (getCustomers/getPoles/getUsers) aren't scoped per
 *     user by APIM itself — the web app's server code is what restricts a
 *     customer-scoped user to their own customer. Mobile reads have to go
 *     through that same enforcement.
 */

export const MOBILE_API = {
  signIn: "/api/mobile/signin",
  signOut: "/api/signout",
  poleLookup: "/api/mobile/pole",
  myCustomer: "/api/mobile/customer",
  customers: "/api/mobile/customers",
  poleInstall: "/api/mobile/poleinstall",
  createPoleIssue: "/api/createpoleissue",
} as const;

/** Every error response from these routes carries a human-readable message. */
export interface ApiErrorResponse {
  error: string;
}

export interface MobileSignInRequest {
  email: string;
  password: string;
}

/**
 * Unlike the web's /api/signin (which hides the JWT in an httpOnly cookie),
 * the mobile route returns the token in the body. The app keeps it in the
 * OS keychain/keystore (expo-secure-store) and sends it back as
 * `Authorization: Bearer <token>`.
 */
export interface MobileSignInResponse {
  token: string;
  user: AuthUser;
}

/**
 * GET /api/mobile/customer — the signed-in user's own customer. Null for
 * Streetleaf staff, who don't belong to a customer. Deliberately takes no
 * id: it can only ever return the caller's own customer.
 */
export interface MyCustomerResponse {
  customer: { id: string; name: string } | null;
}

/** Path builders for the per-customer monitoring routes. */
export const mobileCustomerPath = (customerId: string) =>
  `${MOBILE_API.customers}/${encodeURIComponent(customerId)}`;
export const mobileProjectPath = (customerId: string, projectId: string) =>
  `${mobileCustomerPath(customerId)}/projects/${encodeURIComponent(projectId)}`;

/** GET /api/mobile/customers — Streetleaf staff only (403 for customer-scoped users). Active customers, by name. */
export interface CustomerListResponse {
  customers: { id: string; name: string }[];
}

/** Light counts as the web's StatGroup shows them. Null when APIM has no vitals for it. */
export interface LightStats {
  totalLights: number | null;
  connectedLights: number | null;
  totalFaults: number | null;
  percentWorking: number | null;
}

/**
 * GET /api/mobile/customers/{customerId} — the mobile counterpart of the
 * web's CustomerOverview (customer header, summary stats, project list).
 * A customer-scoped caller gets 404 for any customer but their own.
 */
export interface CustomerOverviewResponse {
  customer: {
    id: string;
    name: string;
    /** Address, city, state and zip joined the same way the web header does it. */
    addressLine: string | null;
    phone: string | null;
    active: boolean;
  };
  summary: LightStats;
  projects: ({ id: string; name: string; active: boolean } & LightStats)[];
}

/** One row of the project screen's pole list (trimmed from PoleVital). */
export interface ProjectPoleRow {
  id: string;
  poleNumber: string;
  connectedText: string | null;
  overallStatusText: string | null;
  lastUpdate: string | null;
  openIssues: number;
}

/** GET /api/mobile/customers/{customerId}/projects/{projectId}. Same scoping as the overview. */
export interface ProjectDetailResponse {
  customer: { id: string; name: string };
  project: { id: string; name: string; active: boolean } & LightStats;
  /** Sorted by pole number, numeric-aware ("PAS-2" before "PAS-10"). */
  poles: ProjectPoleRow[];
}

/** Whether a PoleIssue counts as open (APIM's status casing/whitespace varies). */
export function isOpenIssue(issue: { status: string }): boolean {
  return issue.status.trim().toLowerCase() === "open";
}

/** GET /api/mobile/pole?poleNumber=… — null when no pole with that number is visible to the caller. */
export interface PoleLookupResponse {
  pole: PoleSummary | null;
}

/** Request body for POST /api/mobile/poleinstall. */
export interface PoleInstallRequest {
  poleNumber: string;
  /** Exactly what the scanner read, kept for auditing mis-scans. Null when typed manually. */
  scannedValue: string | null;
  latitude: number;
  longitude: number;
  /** Reported GPS accuracy radius, when the device provides one. */
  accuracyMeters: number | null;
  /** ISO-8601 time the crew member confirmed the install on the device. */
  capturedAt: string;
  notes: string | null;
}

export const POLE_INSTALL_NOTES_MAX_LENGTH = 500;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Validates an untrusted install payload. Used by the web route handler (the
 * real check) and by the mobile app before queueing a submission (so crews
 * get the error on the spot, not after a sync fails hours later).
 */
export function validatePoleInstallRequest(body: unknown): ValidationResult<PoleInstallRequest> {
  if (!body || typeof body !== "object") return { ok: false, error: "Malformed request body." };
  const b = body as Record<string, unknown>;

  if (typeof b.poleNumber !== "string" || !b.poleNumber.trim()) {
    return { ok: false, error: "poleNumber is required." };
  }
  if (b.scannedValue !== null && typeof b.scannedValue !== "string") {
    return { ok: false, error: "scannedValue must be a string or null." };
  }
  if (typeof b.latitude !== "number" || !Number.isFinite(b.latitude) || Math.abs(b.latitude) > 90) {
    return { ok: false, error: "latitude must be a number between -90 and 90." };
  }
  if (
    typeof b.longitude !== "number" ||
    !Number.isFinite(b.longitude) ||
    Math.abs(b.longitude) > 180
  ) {
    return { ok: false, error: "longitude must be a number between -180 and 180." };
  }
  if (
    b.accuracyMeters !== null &&
    (typeof b.accuracyMeters !== "number" || !Number.isFinite(b.accuracyMeters) || b.accuracyMeters < 0)
  ) {
    return { ok: false, error: "accuracyMeters must be a non-negative number or null." };
  }
  if (typeof b.capturedAt !== "string" || Number.isNaN(new Date(b.capturedAt).getTime())) {
    return { ok: false, error: "capturedAt must be an ISO-8601 timestamp." };
  }
  if (b.notes !== null && typeof b.notes !== "string") {
    return { ok: false, error: "notes must be a string or null." };
  }
  if (typeof b.notes === "string" && b.notes.length > POLE_INSTALL_NOTES_MAX_LENGTH) {
    return { ok: false, error: `notes must be at most ${POLE_INSTALL_NOTES_MAX_LENGTH} characters.` };
  }

  return {
    ok: true,
    value: {
      poleNumber: b.poleNumber.trim().toUpperCase(),
      scannedValue: b.scannedValue as string | null,
      latitude: b.latitude,
      longitude: b.longitude,
      accuracyMeters: b.accuracyMeters as number | null,
      capturedAt: b.capturedAt,
      notes: typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
    },
  };
}

/** Issue categories accepted by /api/createpoleissue (the `status` field). */
export const POLE_ISSUE_TYPES = ["Electrical Issue", "Structural Issue"] as const;
export type PoleIssueType = (typeof POLE_ISSUE_TYPES)[number];
export const PROBLEM_DETAILS_MAX_LENGTH = 500;

/** Request body for POST /api/createpoleissue (same route the web uses). */
export interface CreatePoleIssueRequest {
  poleNumber: string;
  status: PoleIssueType;
  problemDetails: string;
}
