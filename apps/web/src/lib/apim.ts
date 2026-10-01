// Azure API Management (APIM) client
//
// This is a thin fetch wrapper for calling the internal Azure APIM gateway.
// Customers are wired to the real /getCustomers endpoint — getCustomers()
// fetches the full list, getCustomer(id) uses the ?customerId= filter to
// fetch just one record. Projects are wired to the real /getProjects
// endpoint via getProjectsForCustomer(customerId). Pole vitals (lights
// working / faults) come from /getPoleVitals via getPoleVitalsForCustomer.
// Poles are wired to the real /getPoles endpoint via getPoles(filters) /
// getPole(poleId), supporting optional poleId/projectId/customerId filters.
// Users are wired to the real /getUsers endpoint via getUsers().
//
// Configure via environment variables (see .env.local.example):
//   NEXT_PUBLIC_APIM_BASE_URL   defaults to https://lights-v2-apim.azure-api.net
//   APIM_SUBSCRIPTION_KEY       Ocp-Apim-Subscription-Key (server-side only)
//   APIM_CACHE_SECONDS          how long responses are cached before Next.js
//                               revalidates in the background (default 30)

import type {
  AuthUser,
  Customer,
  CustomerPoleVitals,
  CustomerProjectRef,
  LeadsunProject,
  PeriodType,
  PoleSummary,
  PoleVitalsByPeriod,
  Project,
  User,
} from "./types";
import { time } from "./timing";

const APIM_BASE_URL =
  process.env.NEXT_PUBLIC_APIM_BASE_URL || "https://lights-v2-apim.azure-api.net";
const APIM_SUBSCRIPTION_KEY = process.env.APIM_SUBSCRIPTION_KEY ?? "";

// The observed 500ms–1900ms swing on /customers is the live network round
// trip to Azure APIM itself (Next.js's own overhead is ~2ms per its request
// log) — most likely backend cold starts or gateway load, not something we
// can fix from this codebase. What we CAN do is stop paying that variable
// cost on every single request: cache each response for this many seconds,
// with Next.js quietly revalidating in the background after it expires.
// Trade-off: a customer record change can take up to this long to show up.
const APIM_CACHE_SECONDS = Number(process.env.APIM_CACHE_SECONDS ?? 30);

export class ApimError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApimError";
  }
}

/**
 * Generic authenticated fetch against the APIM gateway.
 *
 * `tags` lets a caller mark this fetch for on-demand invalidation via
 * Next.js's revalidateTag — used by getUsers() so /api/inviteuser can force
 * the next getUsers() call to hit APIM fresh, rather than the person having
 * to wait out the full APIM_CACHE_SECONDS window after inviting someone.
 *
 * `noStore` skips Next.js's Data Cache entirely — for responses known to
 * exceed its 2MB per-entry limit (e.g. the ~14k-pole /getPoles response),
 * where the framework would otherwise log a "Failed to set fetch cache"
 * warning on every single request while gaining no caching benefit anyway.
 */
export async function apimFetch<T>(
  path: string,
  options?: { tags?: string[]; noStore?: boolean; token?: string | null },
): Promise<T> {
  if (!APIM_BASE_URL) {
    throw new ApimError(
      "NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.",
    );
  }

  return time(`apimFetch ${path}`, async () => {
    const res = await fetch(`${APIM_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
        ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options?.noStore
        ? { cache: "no-store" as const }
        : { next: { revalidate: APIM_CACHE_SECONDS, tags: options?.tags } }),
    });

    if (!res.ok) {
      throw new ApimError(`APIM request failed: ${path}`, res.status);
    }

    return res.json() as Promise<T>;
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Shape returned by GET /getCustomers before we normalize it. */
export interface RawCustomer {
  id: string;
  name: string;
  /** JSON-stringified string[], e.g. "[]" or '["Bayou District Rebuild"]' */
  projectNames: string;
  /** JSON-stringified string[], parallel to projectNames */
  projectIds: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  active: boolean;
}

/** projectNames/projectIds arrive as JSON-stringified arrays; parse defensively. */
export function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Same JSON-stringified-field pattern as poleNumbers/poleIds/installDates
 * above — leadsunProject may arrive as a JSON string rather than an
 * already-parsed object. Also defensively normalizes `groups` to an empty
 * array if it's missing/malformed, so callers never need to null-check
 * that specifically.
 */
function parseLeadsunProject(
  raw: LeadsunProject | string | null | undefined,
): LeadsunProject | null {
  if (!raw) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LeadsunProject>;
  const groups = Array.isArray(candidate.groups) ? candidate.groups : [];
  return {
    ProjectId: candidate.ProjectId ?? "",
    ProjectName: candidate.ProjectName ?? "",
    totalGateways: candidate.totalGateways ?? groups.length,
    totalPoles: candidate.totalPoles ?? 0,
    groups: groups.map((group) => ({
      GroupId: group?.GroupId ?? 0,
      GroupName: group?.GroupName ?? "",
      GatewayCode: group?.GatewayCode ?? "",
      totalPoles: group?.totalPoles ?? group?.products?.length ?? 0,
      products: (Array.isArray(group?.products) ? group.products : []).map((product) => ({
        ProductId: product?.ProductId ?? 0,
        ProductName: product?.ProductName ?? "",
        ProvidedProductId: product?.ProvidedProductId ?? "",
        PoleNumber: product?.PoleNumber ?? "",
      })),
    })),
  };
}

export function normalizeCustomer(raw: RawCustomer): Customer {
  const names = parseJsonStringArray(raw.projectNames);
  const ids = parseJsonStringArray(raw.projectIds);
  const projects: CustomerProjectRef[] = names.map((name, i) => ({
    id: ids[i] ?? `${raw.id}-project-${i}`,
    name,
  }));

  return {
    id: raw.id,
    name: raw.name,
    projects,
    address: raw.address,
    city: raw.city,
    state: raw.state,
    zip: raw.zip,
    phone: raw.phone,
    active: raw.active,
  };
}

export interface CustomerFilters {
  active?: boolean;
}

export async function getCustomers(
  filters?: CustomerFilters,
  token?: string | null,
): Promise<Customer[]> {
  const query = filters?.active !== undefined ? `?active=${filters.active}` : "";
  const raw = await apimFetch<RawCustomer[]>(`/getCustomers${query}`, { token });
  return raw.map(normalizeCustomer);
}

export async function getCustomer(
  id: string,
  token?: string | null,
): Promise<Customer | undefined> {
  return time(`getCustomer(${id})`, async () => {
    // /getCustomers accepts a customerId filter and returns just that record
    // as a single object (confirmed — not wrapped in an array), so we no
    // longer need to fetch and scan the full list for a lookup.
    const raw = await apimFetch<RawCustomer | null>(
      `/getCustomers?customerId=${encodeURIComponent(id)}`,
      { token },
    );
    return raw ? normalizeCustomer(raw) : undefined;
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** Shape returned by GET /getProjects?customerId=... before we normalize it. */
export interface RawProject {
  id: string;
  name: string;
  // Assumed camelCase key, matching this object's other top-level fields —
  // its own nested content keeps Leadsun's native PascalCase, since that's
  // a separate external system's shape passed through as-is. Flag/confirm
  // if the real API uses a different casing for this key specifically.
  // May arrive as a JSON string rather than an already-parsed object.
  leadsunProject?: LeadsunProject | string | null;
  active: boolean;
}

export function normalizeProject(raw: RawProject): Project {
  return {
    id: raw.id,
    name: raw.name,
    leadsunProject: parseLeadsunProject(raw.leadsunProject),
    active: raw.active,
  };
}

export async function getProjectsForCustomer(
  customerId: string,
  token?: string | null,
): Promise<Project[]> {
  const raw = await apimFetch<RawProject[]>(
    `/getProjects?customerId=${encodeURIComponent(customerId)}`,
    { token },
  );
  return raw.map(normalizeProject);
}

// ---------------------------------------------------------------------------
// Pole vitals (lights working / faults, per customer + per project)
// ---------------------------------------------------------------------------

/**
 * Bypasses the Data Cache entirely (unlike most reads via apimFetch,
 * which get a 30s revalidate window) — this powers 4 detail-style pages
 * (customer, project, pole, and the top-level projects list) showing
 * live pole health data: Last Update, connectivity, fault flags. A stale
 * cached response here isn't just "up to 30s old" in practice — Next.js's
 * revalidate is stale-while-revalidate, so the cached value keeps being
 * served until something actually requests it again to trigger a
 * background refresh; a pole/project that isn't visited often can show a
 * reading that's arbitrarily old. Given how much smaller a single
 * customer's own vitals are than the full /getPoles response, the
 * 2MB-cache-entry problem noStore was originally added for elsewhere
 * doesn't apply here — this is purely about freshness.
 */
export async function getPoleVitalsForCustomer(
  customerId: string,
  token?: string | null,
): Promise<CustomerPoleVitals | undefined> {
  const raw = await apimFetch<CustomerPoleVitals | null>(
    `/getPoleVitals?customerId=${encodeURIComponent(customerId)}`,
    { noStore: true, token },
  );
  return raw ?? undefined;
}

// ---------------------------------------------------------------------------
// Poles
// ---------------------------------------------------------------------------

export interface PoleFilters {
  poleId?: string;
  projectId?: string;
  customerId?: string;
}

function buildPoleQuery(filters?: PoleFilters & { summary?: boolean }): string {
  const params = new URLSearchParams();
  if (filters?.poleId) params.set("poleId", filters.poleId);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.customerId) params.set("customerId", filters.customerId);
  if (filters?.summary) params.set("summary", "true");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * GET /getPoles?summary=true, optionally filtered by projectId and/or
 * customerId. Summary mode lifts the 1000-row cap the plain endpoint
 * applies — needed since the whole system has ~14k poles — in exchange for
 * a lighter per-pole payload (no lastUpdate or battery voltages).
 *
 * Sorted here by poleNumber (numeric-aware, so "PAS-4938" precedes
 * "PAS-10000" rather than following it lexicographically) since the
 * backend's own ordering isn't reliably poleNumber order.
 *
 * Uses noStore: the unfiltered response is ~9MB — comfortably over Next's
 * 2MB Data Cache limit — so caching it would fail on every request anyway
 * (logged as a "Failed to set fetch cache" warning), with zero benefit.
 */
export async function getPoles(
  filters?: PoleFilters,
  token?: string | null,
): Promise<PoleSummary[]> {
  const raw = await apimFetch<PoleSummary[]>(
    `/getPoles${buildPoleQuery({ ...filters, summary: true })}`,
    { noStore: true, token },
  );
  return raw
    .slice()
    .sort((a, b) => a.poleNumber.localeCompare(b.poleNumber, undefined, { numeric: true }));
}

/**
 * GET /getPoleVitalsByPeriod?poleId=&periodType=&limit= — powers the pole
 * detail page's vitals-over-time chart. Bypasses apimFetch (like the
 * mutating endpoints) because its generic, body-discarding ApimError would
 * swallow the specific messages this endpoint returns — e.g.
 * "periodType must be one of: Hour, Day" or "pole not found" — which the
 * chart surfaces directly rather than a generic failure. Still a read, so
 * (unlike the mutating endpoints) it keeps the usual revalidate caching.
 */
export async function getPoleVitalsByPeriod({
  poleId,
  periodType,
  limit,
  token,
}: {
  poleId: string;
  periodType: PeriodType;
  limit: number;
  token?: string | null;
}): Promise<PoleVitalsByPeriod> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const query = new URLSearchParams({ poleId, periodType, limit: String(limit) });
  const res = await fetch(`${APIM_BASE_URL}/getPoleVitalsByPeriod?${query}`, {
    headers: {
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: APIM_CACHE_SECONDS },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Failed to load pole vitals.";
    throw new ApimError(message, res.status);
  }

  // Only pass through what the chart actually uses. The real response also
  // carries a top-level id/poleNumber/locationId/installDate/lat/long/
  // lastUpdate (the pole's own identity — redundant with what the page
  // already has from getPoleVitalsForCustomer) and each period also
  // carries periodEnd/lightStatus/isOnline, none of which the chart reads
  // — a blind `as PoleVitalsByPeriod` cast wouldn't actually drop any of
  // that from what's sent to the browser, so this maps explicitly instead.
  const rawVitals = Array.isArray(body?.vitals) ? (body.vitals as Record<string, unknown>[]) : [];
  return {
    vitals: rawVitals.map((v) => ({
      periodStart: v.periodStart as string,
      avgBatteryPercentage: (v.avgBatteryPercentage as number | null) ?? null,
      avgPanelPercentage: (v.avgPanelPercentage as number | null) ?? null,
      avgLightPercentage: (v.avgLightPercentage as number | null) ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * GET /getUsers — returns User[] directly matching our shape, no parsing
 * needed. Tagged "users" so /api/inviteuser can force-refresh this list
 * immediately after a successful invite (see revalidateTag call there).
 */
export async function getUsers(token?: string | null): Promise<User[]> {
  return apimFetch<User[]>("/getUsers", { tags: ["users"], token });
}

/**
 * name, email, and role are always sent; customerId is only included when
 * the invite is for a Customer Admin — Streetleaf Admin invites have no
 * associated customer, matching the sample request/response pair this was
 * wired against (no customerId key at all for a Streetleaf Admin invite,
 * rather than customerId: null).
 */
export interface InviteUserInput {
  name: string;
  email: string;
  role: string;
  customerId?: string;
}

export interface InviteUserResult {
  userId: string;
  email: string;
  emailSent: boolean;
}

/**
 * Like signIn below, this bypasses apimFetch: it's a mutating call (so no
 * caching/revalidation) and we want the real error message from a non-ok
 * response rather than apimFetch's generic, body-discarding ApimError.
 *
 * Unlike the read endpoints, /inviteUser requires the signed-in user's own
 * JWT (from /signIn) as a Bearer token, on top of the subscription key —
 * it 400s with "missing or malformed Authorization header" without it.
 * That token lives in the httpOnly session cookie set by /api/signin, so
 * the route handler reads it and passes it through here.
 */
export async function inviteUser(
  input: InviteUserInput,
  token: string,
): Promise<InviteUserResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const body: Record<string, string> = {
    name: input.name,
    email: input.email,
    role: input.role,
  };
  if (input.customerId) {
    body.customerId = input.customerId;
  }

  const res = await fetch(`${APIM_BASE_URL}/inviteUser`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      responseBody && typeof responseBody.error === "string"
        ? responseBody.error
        : "Invite failed.";
    throw new ApimError(message, res.status);
  }

  return responseBody as InviteUserResult;
}

/**
 * POST /resendInvite — re-sends the invitation email to a user who's still
 * in "Pending" status (accepted an invite that hasn't been completed via
 * registration yet). Doesn't change any user data itself, so unlike
 * inviteUser/deleteUser there's no "users" cache tag to invalidate after
 * this succeeds.
 */
export async function resendInvite(userId: string, token: string): Promise<void> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/resendInvite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body.error === "string" ? body.error : "Resend invite failed.";
    throw new ApimError(message, res.status);
  }
}

export interface ChangeRoleResult {
  userId: string;
  role: string;
  customerId: string | null;
}

/**
 * POST /changeRole — toggles a user between "User" and admin (Customer
 * Admin or Streetleaf Admin, depending on whether they have a customerId)
 * server-side; there's no way to specify which role to change *to*, only
 * whose role to change. Requires the caller to be a Streetleaf Admin or
 * Customer Admin themselves — APIM 400s with "this action requires one
 * of: Streetleaf Admin, Customer Admin" otherwise, which surfaces as-is
 * via the ApimError message below.
 */
export async function changeRole(userId: string, token: string): Promise<ChangeRoleResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/changeRole`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Change role failed.";
    throw new ApimError(message, res.status);
  }

  return body as ChangeRoleResult;
}

export interface SetPoleLightsResult {
  success: boolean;
  message: string;
  statusCode: string;
  data: unknown;
}

/**
 * POST /setPoleLights — the Remote Control modal's GO!/TURN OFF action.
 * Scoped to exactly one of a project, a gateway, or a single pole — pass
 * exactly one of projectId/gatewayCode/poleNumber, matching whichever
 * level the action was opened from. projectId here is our own internal
 * Project.id ("rec..."), not Leadsun's own numeric ProjectId. poleNumber
 * here is actually Leadsun's ProductName field (confirmed by sample
 * data), not our own PoleNumber field, despite the name — Leadsun's own
 * naming, not something to "fix" on our end.
 */
export async function setPoleLights(
  params: {
    brightness: number;
    time: number;
  } & (
    | { projectId: string }
    | { gatewayCode: string }
    | { poleNumber: string }
    | { poleNumbers: string[] }
  ),
  token: string,
): Promise<SetPoleLightsResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/setPoleLights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
    cache: "no-store",
  });

  // A gateway-level failure (502/503/504) often returns an HTML or
  // plain-text error page rather than JSON — .json() alone would silently
  // swallow that, leaving nothing to debug beyond a generic message.
  // Reading as text first and parsing from there keeps the raw body
  // available either way.
  const rawText = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const parsedMessage = body && typeof body.message === "string" ? body.message : null;
    const parsedError = body && typeof body.error === "string" ? body.error : null;

    // APIM's own /setPoleLights operation calls out to Leadsun's own Edge
    // API to actually control the light; this specific text is what comes
    // back when *that* call fails, as a 502 (not a 429) from APIM itself.
    // Observed pattern: works a handful of times, then fails, then keeps
    // failing sooner rather than resetting on reload — classic signs of a
    // rate limit / cooldown enforced on Leadsun's own side, which nothing
    // in our own code can control or bypass.
    const isLeadsunEdgeFailure = parsedError === "Leadsun EDGE API request failed";

    const message = isLeadsunEdgeFailure
      ? "The request was rejected — it's likely being rate-limited right now. Wait a few seconds and try again."
      : (parsedMessage ??
          parsedError ??
          (rawText
            ? `Set pole lights failed (${res.status}): ${rawText.slice(0, 200)}`
            : `Set pole lights failed (${res.status}, empty response body).`));
    throw new ApimError(message, res.status);
  }

  return body as unknown as SetPoleLightsResult;
}

/**
 * POST /deleteUser?userId=... — userId goes in the query string, not the
 * body (unlike inviteUser). Like inviteUser, requires the caller's own JWT
 * as a Bearer token on top of the subscription key, and bypasses apimFetch
 * since this is a mutating call needing the real error message from a
 * non-ok response.
 */
export async function deleteUser(userId: string, token: string): Promise<void> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/deleteUser?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body && typeof body.error === "string" ? body.error : "Delete failed.";
    throw new ApimError(message, res.status);
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// AuthUser lives in @sllights/shared (the mobile sign-in contract uses it too).
export type { AuthUser } from "./types";

export interface SignInResult {
  token: string;
  user: AuthUser;
}

/**
 * POST /signIn. Deliberately doesn't go through apimFetch: that helper (a)
 * caches/revalidates via `next: { revalidate }`, which is wrong for a
 * mutating auth call, and (b) discards the response body on a non-ok
 * status, which is exactly where the useful `{ error: "invalid email or
 * password" }` message lives. On failure this throws an ApimError carrying
 * that message so the sign-in form can show it verbatim instead of a
 * generic failure.
 */
/**
 * customerId is optional and for debugging only — lets a request specify
 * which customer context to sign in under, when the /signin page was
 * visited with a ?customerId= query param. Omitted from the request body
 * entirely when not provided, so normal sign-ins are unaffected.
 */
export async function signIn(
  email: string,
  password: string,
  customerId?: string,
): Promise<SignInResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/signIn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify({ email, password, ...(customerId ? { customerId } : {}) }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Sign in failed.";
    throw new ApimError(message, res.status);
  }

  return body as SignInResult;
}

/**
 * POST /registerUser — completes an invite by setting a password. The
 * request carries the invite token from the emailed link plus the chosen
 * password; no Authorization header is needed since the invite token IS
 * the credential here (there's no signed-in user yet). The response
 * mirrors signIn's shape ({ token, user }) since a successful registration
 * also immediately establishes a session.
 */
export async function registerUser(inviteToken: string, password: string): Promise<SignInResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/registerUser`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify({ token: inviteToken, password }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Registration failed.";
    throw new ApimError(message, res.status);
  }

  return body as SignInResult;
}

/**
 * POST /signOut. Only needs the caller's own JWT as a Bearer token — no
 * request body. Like signIn/inviteUser, bypasses apimFetch since this is a
 * mutating call and we want the real error message from a non-ok response.
 */
export async function signOut(token: string): Promise<void> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/signOut`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body && typeof body.error === "string" ? body.error : "Sign out failed.";
    throw new ApimError(message, res.status);
  }
}

export interface ForgotPasswordResult {
  message: string;
}

/**
 * POST /forgotPassword. Deliberately returns the same generic message
 * ("If that email exists, a reset link has been sent.") whether or not
 * the email actually matches an account — that's a security property, not
 * a bug, so we don't try to surface anything more specific from it. No
 * Authorization header needed; there's no signed-in user at this point.
 */
export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/forgotPassword`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : "Something went wrong. Please try again.";
    throw new ApimError(message, res.status);
  }

  return body as ForgotPasswordResult;
}

export interface ResetPasswordResult {
  success: boolean;
}

/**
 * POST /resetPassword — completes the flow started by forgotPassword. The
 * reset token comes from the emailed link (a different token than an
 * invite token, but the same shape: it's the credential here, so no
 * Authorization header is needed).
 */
export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/resetPassword`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify({ token: resetToken, newPassword }),
    cache: "no-store",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Reset failed.";
    throw new ApimError(message, res.status);
  }

  return body as ResetPasswordResult;
}

export interface CreatePoleIssueInput {
  poleNumber: string;
  /** The issue type — "Electrical Issue" or "Structural Issue" — not a resolution status; matches the shape APIM's own endpoint expects. */
  status: string;
  problemDetails: string;
}

/**
 * POST /createPoleIssue — reports a new issue for a pole. The pole detail
 * page's PoleIssuesLink calls this via /api/createpoleissue, then
 * router.refresh()es so the newly created issue shows up in
 * pole.poleIssues on the next server-fetched render, the same
 * refresh-after-mutate pattern used throughout this app rather than
 * constructing a synthetic issue object client-side.
 */
export async function createPoleIssue(input: CreatePoleIssueInput, token: string): Promise<void> {
  if (!APIM_BASE_URL) {
    throw new ApimError("NEXT_PUBLIC_APIM_BASE_URL is not configured. Set it in .env.local.");
  }

  const res = await fetch(`${APIM_BASE_URL}/createPoleIssue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": APIM_SUBSCRIPTION_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body.error === "string" ? body.error : "Failed to report the issue.";
    throw new ApimError(message, res.status);
  }
}

