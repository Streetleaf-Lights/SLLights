import { ApiError, createApiClient } from "@/api/client";

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("createApiClient", () => {
  it("signs in without an Authorization header", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { token: "t", user: {} }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });

    await api.signIn("a@b.com", "pw");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://x.test/api/mobile/signin");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "pw" });
  });

  it("sends the token as a Bearer header and encodes the pole number", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { pole: null }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");

    await api.lookupPole("PAS 1");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://x.test/api/mobile/pole?poleNumber=PAS%201");
    expect(init.headers.Authorization).toBe("Bearer jwt");
  });

  it("refuses authenticated calls without a token, without hitting the network", async () => {
    const fetchImpl = jest.fn();
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    await expect(api.lookupPole("PAS-1")).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces the server's error message and status", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(501, { error: "Not available yet." }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");
    await expect(api.createPoleIssue({ poleNumber: "P-1", status: "Electrical Issue", problemDetails: "x" })).rejects.toEqual(
      new ApiError("Not available yet.", 501),
    );
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error(); } });
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    await expect(api.signIn("a", "b")).rejects.toMatchObject({ message: "Request failed (502).", status: 502 });
  });

  it("on a 401 clears its token and notifies listeners, who can unsubscribe", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(401, { error: "expired" }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    const listener = jest.fn();
    const unsubscribe = api.onUnauthorized(listener);
    api.setToken("jwt");

    await expect(api.lookupPole("PAS-1")).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    // Token is gone: the next call fails locally.
    await expect(api.lookupPole("PAS-1")).rejects.toMatchObject({ message: "You're signed out. Sign in again." });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    unsubscribe();
    api.setToken("jwt");
    await expect(api.lookupPole("PAS-1")).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not treat a 401 from sign-in (wrong password) as a session expiry", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(401, { error: "invalid email or password" }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    const listener = jest.fn();
    api.onUnauthorized(listener);
    await expect(api.signIn("a", "b")).rejects.toMatchObject({ message: "invalid email or password" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("reports network failures as isNetworkError", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    const err = await api.signIn("a", "b").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isNetworkError).toBe(true);
  });
});

describe("getMyCustomer", () => {
  it("GETs the caller's own customer with the Bearer token", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { customer: { id: "c1", name: "Coastal Power" } }));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");

    await expect(api.getMyCustomer()).resolves.toEqual({ customer: { id: "c1", name: "Coastal Power" } });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://x.test/api/mobile/customer");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer jwt");
  });
});

describe("monitoring calls", () => {
  it("hit the customer, overview and project routes with encoded ids", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, {}));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");

    await api.listCustomers();
    await api.getCustomerOverview("c 1");
    await api.getProject("c1", "p/1");
    await api.getPoleDetail("c1", "p1", "pole 1");

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://x.test/api/mobile/customers",
      "https://x.test/api/mobile/customers/c%201",
      "https://x.test/api/mobile/customers/c1/projects/p%2F1",
      "https://x.test/api/mobile/customers/c1/projects/p1/poles/pole%201",
    ]);
    for (const [, init] of fetchImpl.mock.calls) expect(init.headers.Authorization).toBe("Bearer jwt");
  });
});

describe("successful responses that aren't JSON", () => {
  it("are reported as an error instead of being handed to screens as null", async () => {
    // e.g. an HTML page served with 200 (a login wall, a wrong base URL).
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");

    const err = await api.listCustomers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/unexpected response/i);
    expect((err as ApiError).status).toBe(200);
  });

  it("are reported as an error when the JSON body is null", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, null));
    const api = createApiClient({ baseUrl: "https://x.test", fetchImpl });
    api.setToken("jwt");
    await expect(api.listCustomers()).rejects.toBeInstanceOf(ApiError);
  });
});
