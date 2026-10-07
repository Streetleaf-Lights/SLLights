import {
  MOBILE_API,
  mobileCustomerPath,
  mobilePolePath,
  mobilePoleRemotePath,
  mobilePoleVitalsPath,
  mobileProjectPath,
  type CustomerListResponse,
  type CustomerOverviewResponse,
  type LightCommandResponse,
  type PoleDetailResponse,
  type PoleRemoteResponse,
  type PoleVitalsResponse,
  type ProjectDetailResponse,
  type CreatePoleIssueRequest,
  type MobileSignInResponse,
  type MyCustomerResponse,
  type PoleInstallRequest,
  type PoleLookupResponse,
} from "@sllights/shared/api-contract";

/** A failed call, carrying the server's own message (routes always send `{ error }`). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
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
    init: { method: "GET" | "POST"; body?: unknown; auth: boolean },
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.auth) {
      if (!token) throw new ApiError("You're signed out. Sign in again.", 401);
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError("No connection. Check your signal and try again.", null);
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
