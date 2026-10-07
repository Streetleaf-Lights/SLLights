import {
  MOBILE_API,
  mobileCustomerPath,
  mobilePolePath,
  mobilePoleRemotePath,
  mobileProjectRemotePath,
  mobileUserPath,
  mobilePoleVitalsPath,
  mobileProjectPath,
  type CustomerListResponse,
  type CustomerOverviewResponse,
  type LightCommandResponse,
  type PoleDetailResponse,
  type PoleListQuery,
  type PoleListResponse,
  type PoleRemoteResponse,
  type ProjectRemoteResponse,
  type ChangeRoleResponse,
  type TransferOwnershipResponse,
  type InviteUserRequest,
  type InviteUserResponse,
  type UsersResponse,
  type PoleVitalsResponse,
  type ProjectDetailResponse,
  type CreatePoleIssueRequest,
  type MobileSignInResponse,
  type MobileRegisterResponse,
  type ForgotPasswordResponse,
  type MyCustomerResponse,
  type PoleInstallRequest,
  type PoleLookupResponse,
} from "@sllights/shared/api-contract";
import type { ProjectLightCommand } from "@sllights/shared/remote-control";

/** A failed call, carrying the server's own message (routes always send `{ error }`). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    /** The request was abandoned for taking too long (the server never answered in time). */
    public readonly timedOut = false,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** No response at all — dead zone, airplane mode, server unreachable. */
  get isNetworkError(): boolean {
    return this.status === null;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The Poles list's longer allowance; everything else uses the client's default (20 s). */
export const POLE_LIST_TIMEOUT_MS = 60_000;

export function createApiClient({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 20_000,
}: ApiClientOptions) {
  // The client owns the session token, so nothing outside it has to hold a
  // mutable ref that render code might read.
  let token: string | null = null;
  const unauthorizedListeners = new Set<() => void>();
  async function request<T>(
    path: string,
    init: { method: "GET" | "POST" | "DELETE"; body?: unknown; auth: boolean; timeoutMs?: number },
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.auth) {
      if (!token) throw new ApiError("You're signed out. Sign in again.", 401);
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, init.timeoutMs ?? timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      // Our own timeout aborting the request is not the same as no signal.
      throw timedOut
        ? new ApiError("The server took too long to respond. Please try again.", null, true)
        : new ApiError("No connection. Check your signal and try again.", null);
    } finally {
      clearTimeout(timer);
    }

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && init.auth) {
        // APIM no longer accepts this token: drop it and tell the app.
        token = null;
        unauthorizedListeners.forEach((listener) => listener());
      }
      const message =
        body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Request failed (${res.status}).`;
      throw new ApiError(message, res.status);
    }
    // Every route answers with a JSON object. Anything else on a success
    // status (an HTML login wall, a wrong EXPO_PUBLIC_API_BASE_URL, a proxy
    // page) must not reach screens as `null` data.
    if (body === null || typeof body !== "object") {
      throw new ApiError(
        `Unexpected response from the server (${res.status}). Check the app is pointed at the SLLights web app.`,
        res.status,
      );
    }
    return body as T;
  }

  return {
    setToken(next: string | null) {
      token = next;
    },

    /** Subscribe to "the server rejected our token" (any 401 on an authenticated call). Returns an unsubscribe. */
    onUnauthorized(listener: () => void): () => void {
      unauthorizedListeners.add(listener);
      return () => unauthorizedListeners.delete(listener);
    },

    signIn(email: string, password: string) {
      return request<MobileSignInResponse>(MOBILE_API.signIn, {
        method: "POST",
        body: { email, password },
        auth: false,
      });
    },

    /** Completes an emailed invite ("Set your password") and returns a session, like signIn. */
    register(inviteToken: string, password: string) {
      return request<MobileRegisterResponse>(MOBILE_API.register, {
        method: "POST",
        body: { token: inviteToken, password },
        auth: false,
      });
    },

    /** Always resolves with the same generic message, whether or not the account exists. */
    forgotPassword(email: string) {
      return request<ForgotPasswordResponse>(MOBILE_API.forgotPassword, { method: "POST", body: { email }, auth: false });
    },

    resetPassword(resetToken: string, newPassword: string) {
      return request<{ success?: boolean }>(MOBILE_API.resetPassword, {
        method: "POST",
        body: { token: resetToken, newPassword },
        auth: false,
      });
    },

    /** Best effort: APIM invalidates the token; the caller clears local state regardless. */
    signOut() {
      return request<{ success: true }>(MOBILE_API.signOut, { method: "POST", auth: true });
    },

    /** The signed-in user's own customer (null for Streetleaf staff). */
    getMyCustomer() {
      return request<MyCustomerResponse>(MOBILE_API.myCustomer, { method: "GET", auth: true });
    },

    /** Streetleaf staff only: active customers to browse. */
    listCustomers() {
      return request<CustomerListResponse>(MOBILE_API.customers, { method: "GET", auth: true });
    },

    getCustomerOverview(customerId: string) {
      return request<CustomerOverviewResponse>(mobileCustomerPath(customerId), { method: "GET", auth: true });
    },

    getProject(customerId: string, projectId: string) {
      return request<ProjectDetailResponse>(mobileProjectPath(customerId, projectId), { method: "GET", auth: true });
    },

    getPoleDetail(customerId: string, projectId: string, poleId: string) {
      return request<PoleDetailResponse>(mobilePolePath(customerId, projectId, poleId), { method: "GET", auth: true });
    },

    /** Hourly vitals for the pole page's chart (days: 1, 2, 7, 14 or 30). */
    getPoleVitals(customerId: string, projectId: string, poleId: string, days: number) {
      return request<PoleVitalsResponse>(mobilePoleVitalsPath(customerId, projectId, poleId, days), {
        method: "GET",
        auth: true,
      });
    },

    /** The pole's Leadsun remote-control identity and live ON/OFF state (null when it has none). */
    getPoleRemote(customerId: string, projectId: string, poleId: string) {
      return request<PoleRemoteResponse>(mobilePoleRemotePath(customerId, projectId, poleId), { method: "GET", auth: true });
    },

    /** Switches this pole's light. The server picks the lamp; only brightness and time are sent. */
    sendLightCommand(customerId: string, projectId: string, poleId: string, command: { brightness: number; time: number }) {
      return request<LightCommandResponse>(mobilePoleRemotePath(customerId, projectId, poleId), {
        method: "POST",
        body: command,
        auth: true,
      });
    },

    /** The project's Leadsun gateways and lights with live state (null when it has none). */
    getProjectRemote(customerId: string, projectId: string) {
      return request<ProjectRemoteResponse>(mobileProjectRemotePath(customerId, projectId), { method: "GET", auth: true });
    },

    /** Project / Gateway / light Control for this project; the server checks the target belongs to it. */
    sendProjectLightCommand(customerId: string, projectId: string, command: ProjectLightCommand) {
      return request<LightCommandResponse>(mobileProjectRemotePath(customerId, projectId), {
        method: "POST",
        body: command,
        auth: true,
      });
    },

    /** The Poles list, searched and paged on the server (10 per page). */
    listPoles(query: PoleListQuery = {}) {
      // Built by hand: React Native's URLSearchParams has historically lacked set().
      const params: [string, string][] = [];
      if (query.q?.trim()) params.push(["q", query.q.trim()]);
      if (query.page && query.page > 1) params.push(["page", String(query.page)]);
      if (query.faults) {
        params.push(["faults", "1"], ["customerId", query.faults.customerId]);
        if (query.faults.projectId) params.push(["projectId", query.faults.projectId]);
      }
      const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      return request<PoleListResponse>(`${MOBILE_API.poles}${qs ? `?${qs}` : ""}`, {
        method: "GET",
        auth: true,
        // For staff, the server's first (uncached) load fetches every pole from APIM.
        timeoutMs: POLE_LIST_TIMEOUT_MS,
      });
    },

    /** The people the viewer may see, each with the viewer's allowed actions. */
    listUsers() {
      return request<UsersResponse>(MOBILE_API.users, { method: "GET", auth: true });
    },

    reinviteUser(userId: string) {
      return request<{ success: true }>(`${mobileUserPath(userId)}/reinvite`, { method: "POST", auth: true });
    },

    changeUserRole(userId: string) {
      return request<ChangeRoleResponse>(`${mobileUserPath(userId)}/role`, { method: "POST", auth: true });
    },

    /** Invites a new Customer Owner for this Owner's customer (the server fixes the customer and role). */
    transferOwnership(ownerId: string, newOwner: { name: string; email: string }) {
      return request<TransferOwnershipResponse>(`${mobileUserPath(ownerId)}/transfer-ownership`, {
        method: "POST",
        body: newOwner,
        auth: true,
      });
    },

    /** The web's Invite User; the server enforces the customer and role rules. */
    inviteUser(invite: InviteUserRequest) {
      return request<InviteUserResponse>(`${MOBILE_API.users}/invite`, { method: "POST", body: invite, auth: true });
    },

    deleteUser(userId: string) {
      return request<{ success: true }>(mobileUserPath(userId), { method: "DELETE", auth: true });
    },

    lookupPole(poleNumber: string) {
      return request<PoleLookupResponse>(
        `${MOBILE_API.poleLookup}?poleNumber=${encodeURIComponent(poleNumber)}`,
        { method: "GET", auth: true },
      );
    },

    createPoleIssue(input: CreatePoleIssueRequest) {
      return request<{ success: true }>(MOBILE_API.createPoleIssue, {
        method: "POST",
        body: input,
        auth: true,
      });
    },

    submitPoleInstall(input: PoleInstallRequest) {
      return request<{ success: true }>(MOBILE_API.poleInstall, {
        method: "POST",
        body: input,
        auth: true,
      });
    },
  };
}
