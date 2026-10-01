import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApimError,
  apimFetch,
  changeRole,
  createPoleIssue,
  getCustomer,
  getCustomers,
  getPoleVitalsByPeriod,
  getPoleVitalsForCustomer,
  getPoles,
  deleteUser,
  forgotPassword,
  getProjectsForCustomer,
  getUsers,
  inviteUser,
  normalizeCustomer,
  normalizeProject,
  parseJsonStringArray,
  registerUser,
  resendInvite,
  resetPassword,
  setPoleLights,
  signIn,
  signOut,
  type RawCustomer,
  type RawProject,
} from "@/lib/apim";

describe("parseJsonStringArray", () => {
  it("parses a JSON array string", () => {
    expect(parseJsonStringArray('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty array string", () => {
    expect(parseJsonStringArray("[]")).toEqual([]);
  });

  it("returns an empty array for null", () => {
    expect(parseJsonStringArray(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(parseJsonStringArray(undefined)).toEqual([]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseJsonStringArray("not json")).toEqual([]);
  });

  it("returns an empty array when the parsed JSON isn't an array", () => {
    expect(parseJsonStringArray('{"a":1}')).toEqual([]);
  });

  it("coerces non-string array elements to strings", () => {
    expect(parseJsonStringArray("[1,2,3]")).toEqual(["1", "2", "3"]);
  });
});

describe("normalizeCustomer", () => {
  const raw: RawCustomer = {
    id: "rec123",
    name: "15LightYears",
    projectNames: JSON.stringify(["Bayou District Rebuild", "Storm Hardening"]),
    projectIds: JSON.stringify(["p1", "p2"]),
    address: "412 Harbor Ave",
    city: "New Orleans",
    state: "LA",
    zip: "70115",
    phone: "504-555-0132",
    active: true,
  };

  it("zips projectNames and projectIds into project refs", () => {
    const customer = normalizeCustomer(raw);
    expect(customer.projects).toEqual([
      { id: "p1", name: "Bayou District Rebuild" },
      { id: "p2", name: "Storm Hardening" },
    ]);
  });

  it("passes through the scalar fields unchanged", () => {
    const customer = normalizeCustomer(raw);
    expect(customer.id).toBe("rec123");
    expect(customer.name).toBe("15LightYears");
    expect(customer.address).toBe("412 Harbor Ave");
    expect(customer.city).toBe("New Orleans");
    expect(customer.state).toBe("LA");
    expect(customer.zip).toBe("70115");
    expect(customer.phone).toBe("504-555-0132");
  });

  it("passes through the active field unchanged", () => {
    expect(normalizeCustomer({ ...raw, active: true }).active).toBe(true);
    expect(normalizeCustomer({ ...raw, active: false }).active).toBe(false);
  });

  it("returns an empty projects array when projectNames/projectIds are empty", () => {
    const customer = normalizeCustomer({ ...raw, projectNames: "[]", projectIds: "[]" });
    expect(customer.projects).toEqual([]);
  });

  it("falls back to a generated id if projectIds is shorter than projectNames", () => {
    const customer = normalizeCustomer({
      ...raw,
      projectNames: JSON.stringify(["Only Name"]),
      projectIds: "[]",
    });
    expect(customer.projects).toEqual([{ id: "rec123-project-0", name: "Only Name" }]);
  });

  it("passes through null fields as null", () => {
    const customer = normalizeCustomer({
      ...raw,
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      active: true,
    });
    expect(customer.address).toBeNull();
    expect(customer.city).toBeNull();
    expect(customer.state).toBeNull();
    expect(customer.zip).toBeNull();
    expect(customer.phone).toBeNull();
  });
});

describe("apimFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the subscription key header and parses JSON on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "1" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apimFetch<{ id: string }[]>("/getCustomers");

    expect(result).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/getCustomers");
    expect(init.headers).toHaveProperty("Ocp-Apim-Subscription-Key");
  });

  it("caches responses with a revalidate window instead of forcing no-store", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getCustomers");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).not.toBe("no-store");
    expect(init.next).toEqual(expect.objectContaining({ revalidate: expect.any(Number) }));
    expect(init.next.revalidate).toBeGreaterThan(0);
  });

  it("passes tags through to next.tags for on-demand revalidation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getUsers", { tags: ["users"] });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.next.tags).toEqual(["users"]);
  });

  it("uses cache: no-store (and skips next.revalidate) when noStore is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getPoles", { noStore: true });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("includes the token as a Bearer Authorization header when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getCustomers", { token: "jwt-token" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
  });

  it("omits the Authorization header entirely when no token is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getCustomers");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("also omits the Authorization header when token is explicitly null (not logged in)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await apimFetch("/getCustomers", { token: null });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("throws an ApimError when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    await expect(apimFetch("/getCustomers")).rejects.toThrow(ApimError);
  });

  it("includes the HTTP status on the thrown ApimError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    try {
      await apimFetch("/getCustomers");
      throw new Error("expected apimFetch to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApimError);
      expect((err as ApimError).status).toBe(401);
    }
  });
});

describe("getCustomers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rawCustomers: RawCustomer[] = [
    {
      id: "r1",
      name: "15LightYears",
      projectNames: "[]",
      projectIds: "[]",
      address: null,
      city: null,
      state: "FL",
      zip: null,
      phone: null,
      active: true,
    },
    {
      id: "r2",
      name: "Coastal Power & Light",
      projectNames: JSON.stringify(["Bayou District Rebuild"]),
      projectIds: JSON.stringify(["p1"]),
      address: null,
      city: "New Orleans",
      state: "LA",
      zip: null,
      phone: "504-555-0132",
      active: true,
    },
  ];

  it("normalizes every record from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => rawCustomers }),
    );

    const customers = await getCustomers();

    expect(customers).toHaveLength(2);
    expect(customers[1].projects).toEqual([{ id: "p1", name: "Bayou District Rebuild" }]);
  });

  it("passes through the active field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ...rawCustomers[0], active: false }],
      }),
    );

    const customers = await getCustomers();
    expect(customers[0].active).toBe(false);
  });

  it("calls /getCustomers with no query string when no filter is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawCustomers });
    vi.stubGlobal("fetch", fetchMock);

    await getCustomers();

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("?");
  });

  it("calls /getCustomers?active=true when filtered to active customers, e.g. for the Customers list page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawCustomers });
    vi.stubGlobal("fetch", fetchMock);

    await getCustomers({ active: true });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getCustomers?active=true");
  });

  it("calls /getCustomers?active=false when explicitly filtered to inactive customers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawCustomers });
    vi.stubGlobal("fetch", fetchMock);

    await getCustomers({ active: false });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getCustomers?active=false");
  });
});

describe("getCustomer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rawCoastal: RawCustomer = {
    id: "r2",
    name: "Coastal Power & Light",
    projectNames: JSON.stringify(["Bayou District Rebuild"]),
    projectIds: JSON.stringify(["p1"]),
    address: null,
    city: "New Orleans",
    state: "LA",
    zip: null,
    phone: "504-555-0132",
    active: true,
  };

  it("calls /getCustomers with a customerId filter rather than fetching the full list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => rawCoastal });
    vi.stubGlobal("fetch", fetchMock);

    await getCustomer("r2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getCustomers?customerId=r2");
  });

  it("normalizes the record returned as a single object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => rawCoastal }),
    );

    const customer = await getCustomer("r2");

    expect(customer?.name).toBe("Coastal Power & Light");
    expect(customer?.projects).toEqual([{ id: "p1", name: "Bayou District Rebuild" }]);
  });

  it("returns undefined when the API returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => null }));

    const customer = await getCustomer("does-not-exist");

    expect(customer).toBeUndefined();
  });

  it("URL-encodes the id in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);

    await getCustomer("rec with space");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("customerId=rec%20with%20space");
  });
});

describe("normalizeProject", () => {
  const raw: RawProject = {
    id: "recRHN9eR4itukKGo",
    name: "29N Greene - Creekside Amenity-VA",
    active: true,
  };

  it("passes through the scalar fields unchanged", () => {
    const project = normalizeProject(raw);
    expect(project.id).toBe("recRHN9eR4itukKGo");
    expect(project.name).toBe("29N Greene - Creekside Amenity-VA");
  });

  it("defaults leadsunProject to null when the raw field is absent", () => {
    const project = normalizeProject(raw);
    expect(project.leadsunProject).toBeNull();
  });

  it("parses leadsunProject from its JSON-stringified form, same pattern as other JSON-stringified fields elsewhere in this API", () => {
    const leadsunProjectJson = JSON.stringify({
      ProjectId: "545",
      ProjectName: "Manatee County - Buffalo Creek",
      totalGateways: 1,
      totalPoles: 1,
      groups: [
        {
          GroupId: 1263,
          GroupName: "Buffalo Creek",
          GatewayCode: "GT12L94A2310260A",
          totalPoles: 1,
          products: [
            {
              ProductId: 12548,
              ProductName: "12081-1102",
              ProvidedProductId: "AEXSAP4323111877",
              PoleNumber: "AEXSAP4323111877-A",
            },
          ],
        },
      ],
    });
    const project = normalizeProject({ ...raw, leadsunProject: leadsunProjectJson });
    expect(project.leadsunProject?.ProjectId).toBe("545");
    expect(project.leadsunProject?.ProjectName).toBe("Manatee County - Buffalo Creek");
    expect(project.leadsunProject?.groups).toHaveLength(1);
    expect(project.leadsunProject?.groups[0].products[0].ProductName).toBe("12081-1102");
  });

  it("also accepts leadsunProject as an already-parsed object (not just a JSON string)", () => {
    const project = normalizeProject({
      ...raw,
      leadsunProject: {
        ProjectId: "545",
        ProjectName: "Manatee County - Buffalo Creek",
        totalGateways: 0,
        totalPoles: 0,
        groups: [],
      },
    });
    expect(project.leadsunProject?.ProjectId).toBe("545");
    expect(project.leadsunProject?.groups).toEqual([]);
  });

  it("normalizes a missing/malformed groups field to an empty array rather than crashing downstream code", () => {
    const project = normalizeProject({
      ...raw,
      // @ts-expect-error deliberately malformed for this test (missing groups)
      leadsunProject: { ProjectId: "545", ProjectName: "X" },
    });
    expect(project.leadsunProject?.groups).toEqual([]);
  });

  it("passes through PoleNumber on each product", () => {
    const project = normalizeProject({
      ...raw,
      leadsunProject: {
        ProjectId: "545",
        ProjectName: "Manatee County - Buffalo Creek",
        totalGateways: 1,
        totalPoles: 1,
        groups: [
          {
            GroupId: 1149,
            GroupName: "Chaparral Ph3",
            GatewayCode: "GT18L94A25082883",
            totalPoles: 1,
            products: [
              {
                ProductId: 10358,
                ProductName: "12009-1000",
                ProvidedProductId: "AE3SAP7323113143",
                PoleNumber: "12009-1000-A",
              },
            ],
          },
        ],
      },
    });
    expect(project.leadsunProject?.groups[0].products[0].PoleNumber).toBe("12009-1000-A");
  });

  it("defaults a product's missing fields (including PoleNumber) to safe values rather than leaving them undefined at runtime, despite the type saying they're always present", () => {
    const project = normalizeProject({
      ...raw,
      leadsunProject: {
        ProjectId: "545",
        ProjectName: "X",
        totalGateways: 1,
        totalPoles: 1,
        groups: [
          {
            GroupId: 1,
            GroupName: "G",
            GatewayCode: "GW1",
            totalPoles: 1,
            // @ts-expect-error deliberately missing every product field for this test
            products: [{}],
          },
        ],
      },
    });
    expect(project.leadsunProject?.groups[0].products[0]).toEqual({
      ProductId: 0,
      ProductName: "",
      ProvidedProductId: "",
      PoleNumber: "",
    });
  });

  it("no longer has a UserName field on leadsunProject (removed from the real API)", () => {
    const project = normalizeProject({
      ...raw,
      leadsunProject: {
        ProjectId: "545",
        ProjectName: "X",
        totalGateways: 0,
        totalPoles: 0,
        groups: [],
      },
    });
    expect(project.leadsunProject).not.toHaveProperty("UserName");
  });

  it("returns null (not a crash) for an unparseable leadsunProject string", () => {
    const project = normalizeProject({ ...raw, leadsunProject: "{not valid json" });
    expect(project.leadsunProject).toBeNull();
  });

  it("returns null for an empty-string leadsunProject", () => {
    const project = normalizeProject({ ...raw, leadsunProject: "" });
    expect(project.leadsunProject).toBeNull();
  });

  it("passes through the active field", () => {
    expect(normalizeProject({ ...raw, active: true }).active).toBe(true);
    expect(normalizeProject({ ...raw, active: false }).active).toBe(false);
  });
});

describe("getProjectsForCustomer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rawProjects: RawProject[] = [
    {
      id: "recRHN9eR4itukKGo",
      name: "29N Greene - Creekside Amenity-VA",
      active: true,
    },
  ];

  it("calls /getProjects with a customerId filter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => rawProjects });
    vi.stubGlobal("fetch", fetchMock);

    await getProjectsForCustomer("recRYzYBqtW5CIVhn");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getProjects?customerId=recRYzYBqtW5CIVhn");
  });

  it("normalizes every project returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => rawProjects }),
    );

    const projects = await getProjectsForCustomer("recRYzYBqtW5CIVhn");

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe("recRHN9eR4itukKGo");
    expect(projects[0].name).toBe("29N Greene - Creekside Amenity-VA");
  });

  it("URL-encodes the customerId in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await getProjectsForCustomer("rec with space");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("customerId=rec%20with%20space");
  });
});

describe("getPoleVitalsForCustomer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rawVitals = {
    id: "recD6nliOfFlp0VFh",
    name: "Acacia Fields CDD",
    totalLights: 88,
    connectedLights: 84,
    totalFaults: 0,
    percentWorking: 100.0,
    projects: [
      {
        id: "reczugRdlKOZ6ehTn",
        name: "Acacia Fields CDD - Boger Ph 1A Ph 1B",
        totalLights: 54,
        connectedLights: 51,
        totalFaults: 0,
        percentWorking: 100.0,
      },
      {
        id: "recZWPEWVW3gLSqJm",
        name: "Acacia Fields CDD - Plazewski",
        totalLights: 34,
        connectedLights: 32,
        totalFaults: 0,
        percentWorking: 100.0,
      },
    ],
  };

  it("calls /getPoleVitals with a customerId filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawVitals });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsForCustomer("recD6nliOfFlp0VFh");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getPoleVitals?customerId=recD6nliOfFlp0VFh");
  });

  it("returns the customer-level vitals with the nested per-project breakdown intact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => rawVitals }),
    );

    const vitals = await getPoleVitalsForCustomer("recD6nliOfFlp0VFh");

    expect(vitals?.totalLights).toBe(88);
    expect(vitals?.percentWorking).toBe(100.0);
    expect(vitals?.totalFaults).toBe(0);
    expect(vitals?.projects).toHaveLength(2);
    expect(vitals?.projects[0]).toMatchObject({
      id: "reczugRdlKOZ6ehTn",
      totalLights: 54,
      percentWorking: 100.0,
    });
  });

  it("returns undefined when the API returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => null }));

    const vitals = await getPoleVitalsForCustomer("does-not-exist");

    expect(vitals).toBeUndefined();
  });

  it("URL-encodes the customerId in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => null });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsForCustomer("rec with space");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("customerId=rec%20with%20space");
  });

  it("uses cache: no-store, for freshness — this powers detail pages showing live pole status, where a stale-while-revalidate cache entry could otherwise persist for far longer than its nominal revalidate window", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rawVitals });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsForCustomer("recD6nliOfFlp0VFh");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });
});

describe("getPoles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Matches the real /getPoles?summary=true shape: has lastUpdate now, but
  // still no batteryVoltage1/2 (those only come back from the full,
  // non-summary form).
  const rawSummaryPole = {
    id: "recmb0TRqqEmAnT9T",
    poleNumber: "TEC-2691",
    locationId: "11439",
    active: true,
    installDate: "2025-04-22",
    lat: 0.0,
    long: 0.0,
    lastUpdate: "2026-07-26 13:25:41+00:00",
    isOnline: null,
    avgBatteryPercentage: null,
    avgPanelPercentage: null,
    avgLightPercentage: null,
    projectId: "rec08jIrGQcE5tmNb",
    customerId: "recwx649JfiRmWqxF",
  };

  it("always includes summary=true, to lift the 1000-row cap on the ~14k poles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] });
    vi.stubGlobal("fetch", fetchMock);

    await getPoles();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getPoles?summary=true");
  });

  it("uses cache: no-store, since the unfiltered response is always well over Next's 2MB cache limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] });
    vi.stubGlobal("fetch", fetchMock);

    await getPoles();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("returns the poles as-is (already matches our PoleSummary shape)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] }),
    );

    const poles = await getPoles();

    expect(poles).toHaveLength(1);
    expect(poles[0]).toMatchObject({
      id: "recmb0TRqqEmAnT9T",
      poleNumber: "TEC-2691",
      customerId: "recwx649JfiRmWqxF",
      projectId: "rec08jIrGQcE5tmNb",
    });
    // Summary responses now include lastUpdate, but still not these two —
    // confirm we don't invent them.
    expect(poles[0]).toHaveProperty("lastUpdate", "2026-07-26 13:25:41+00:00");
    expect(poles[0]).not.toHaveProperty("batteryVoltage1");
    expect(poles[0]).not.toHaveProperty("batteryVoltage2");
  });

  it("sorts the returned poles by poleNumber, regardless of the order the backend returns them in", async () => {
    const outOfOrderPoles = [
      { ...rawSummaryPole, id: "p2", poleNumber: "PAS-4939" },
      { ...rawSummaryPole, id: "p1", poleNumber: "PAS-4938" },
      { ...rawSummaryPole, id: "p3", poleNumber: "PAS-4940" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => outOfOrderPoles }),
    );

    const poles = await getPoles();

    expect(poles.map((p) => p.poleNumber)).toEqual(["PAS-4938", "PAS-4939", "PAS-4940"]);
  });

  it("sorts poleNumber numerically, not lexicographically (PAS-4938 before PAS-10000)", async () => {
    const outOfOrderPoles = [
      { ...rawSummaryPole, id: "p2", poleNumber: "PAS-10000" },
      { ...rawSummaryPole, id: "p1", poleNumber: "PAS-4938" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => outOfOrderPoles }),
    );

    const poles = await getPoles();

    // A plain lexicographic sort would put "PAS-10000" first (since '1' < '4'
    // as characters) — the numeric-aware sort should not.
    expect(poles.map((p) => p.poleNumber)).toEqual(["PAS-4938", "PAS-10000"]);
  });

  it("applies the customerId filter alongside summary=true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] });
    vi.stubGlobal("fetch", fetchMock);

    await getPoles({ customerId: "recwx649JfiRmWqxF" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("customerId=recwx649JfiRmWqxF");
    expect(url).toContain("summary=true");
  });

  it("applies the projectId filter alongside summary=true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] });
    vi.stubGlobal("fetch", fetchMock);

    await getPoles({ projectId: "rec3ZJtlb5vqkHPS1" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("projectId=rec3ZJtlb5vqkHPS1");
    expect(url).toContain("summary=true");
  });

  it("applies multiple filters together, alongside summary=true", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [rawSummaryPole] });
    vi.stubGlobal("fetch", fetchMock);

    await getPoles({ customerId: "cust1", projectId: "proj1" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("customerId=cust1");
    expect(url).toContain("projectId=proj1");
    expect(url).toContain("summary=true");
  });
});

describe("getPoleVitalsByPeriod", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = {
    id: "recAOlPiepBddUcCv",
    poleNumber: "01095-1000",
    locationId: "01095-1000",
    active: true,
    installDate: "2025-09-28",
    lat: 28.30129789476302,
    long: -82.27204515451723,
    lastUpdate: "2026-07-30 15:18:27+00:00",
    vitals: [
      {
        periodStart: "2026-07-30 11:00:00-04:00",
        periodEnd: "2026-07-30 12:00:00-04:00",
        isOnline: true,
        avgBatteryPercentage: 100.0,
        avgPanelPercentage: 0.16278533333333334,
        avgLightPercentage: 0.0,
      },
    ],
  };

  it("calls /getPoleVitalsByPeriod with poleId, periodType, and limit as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsByPeriod({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: 48 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/getPoleVitalsByPeriod?");
    expect(url).toContain("poleId=recAOlPiepBddUcCv");
    expect(url).toContain("periodType=Hour");
    expect(url).toContain("limit=48");
  });

  it("includes the token as a Bearer Authorization header when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsByPeriod({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Hour",
      limit: 48,
      token: "jwt-token",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
  });

  it("omits the Authorization header entirely when no token is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsByPeriod({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: 48 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("does not request caching bypass — this is a read, so it keeps the usual revalidate window", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await getPoleVitalsByPeriod({ poleId: "recAOlPiepBddUcCv", periodType: "Day", limit: 30 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.next).toEqual({ revalidate: 30 });
  });

  it("returns only the vitals array, trimmed to what the chart uses — not the pole's own identity fields (id/poleNumber/locationId/installDate/lat/long/lastUpdate) or each period's periodEnd/isOnline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await getPoleVitalsByPeriod({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Hour",
      limit: 48,
    });

    expect(result).toEqual({
      vitals: [
        {
          periodStart: "2026-07-30 11:00:00-04:00",
          avgBatteryPercentage: 100.0,
          avgPanelPercentage: 0.16278533333333334,
          avgLightPercentage: 0.0,
        },
      ],
    });
  });

  it("defaults a period's percentage fields to null when missing, rather than passing through undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...successBody,
          vitals: [{ periodStart: "2026-07-30 11:00:00-04:00" }],
        }),
      }),
    );

    const result = await getPoleVitalsByPeriod({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Hour",
      limit: 48,
    });

    expect(result).toEqual({
      vitals: [
        {
          periodStart: "2026-07-30 11:00:00-04:00",
          avgBatteryPercentage: null,
          avgPanelPercentage: null,
          avgLightPercentage: null,
        },
      ],
    });
  });

  it("returns an empty vitals array when the response's vitals field is missing or not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...successBody, vitals: null }) }),
    );

    const result = await getPoleVitalsByPeriod({
      poleId: "recAOlPiepBddUcCv",
      periodType: "Hour",
      limit: 48,
    });

    expect(result).toEqual({ vitals: [] });
  });

  it("throws an ApimError carrying the server's message for an invalid periodType", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "periodType must be one of: Hour, Day" }),
      }),
    );

    await expect(
      getPoleVitalsByPeriod({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: 48 }),
    ).rejects.toMatchObject({
      message: "periodType must be one of: Hour, Day",
      status: 400,
    });
  });

  it("throws an ApimError carrying the server's message when the pole isn't found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "pole not found" }),
      }),
    );

    await expect(
      getPoleVitalsByPeriod({ poleId: "does-not-exist", periodType: "Hour", limit: 48 }),
    ).rejects.toMatchObject({ message: "pole not found", status: 404 });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(
      getPoleVitalsByPeriod({ poleId: "recAOlPiepBddUcCv", periodType: "Hour", limit: 48 }),
    ).rejects.toMatchObject({ message: "Failed to load pole vitals.", status: 500 });
  });
});

describe("getUsers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const rawUser = {
    id: "user1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "Customer Admin",
    status: "Active",
    customerId: "cust1",
    customerName: "Acme Corp",
  };

  it("calls /getUsers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [rawUser] });
    vi.stubGlobal("fetch", fetchMock);

    await getUsers();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/getUsers$/);
  });

  it("tags its fetch with 'users', so /api/inviteuser can force-refresh it after an invite", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [rawUser] });
    vi.stubGlobal("fetch", fetchMock);

    await getUsers();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.next.tags).toEqual(["users"]);
  });

  it("returns the users as-is (already matches our User shape)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [rawUser] }));

    const users = await getUsers();

    expect(users).toEqual([rawUser]);
  });
});

describe("inviteUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = {
    userId: "8714b64b-1186-487a-820a-6ee0c53a2b25",
    email: "minh+9@streetleaf.com",
    emailSent: true,
  };

  it("posts name, email, and role, without a customerId key, for a Streetleaf Admin invite", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await inviteUser(
      { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
      "jwt-token",
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/inviteUser$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Minh Tran",
      email: "minh@streetleaf.com",
      role: "Streetleaf Admin",
    });
  });

  it("sends the token as a Bearer Authorization header (APIM requires it on top of the subscription key)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await inviteUser(
      { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
      "jwt-token",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
  });

  it("includes customerId when provided (Customer Admin invites)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await inviteUser(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        role: "Customer Admin",
        customerId: "cust-2",
      },
      "jwt-token",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      role: "Customer Admin",
      customerId: "cust-2",
    });
  });

  it("does not request caching/revalidation (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await inviteUser(
      { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
      "jwt-token",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("returns the userId/email/emailSent result on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await inviteUser(
      {
        name: "Minh Tran",
        email: "minh@streetleaf.com",
        role: "Streetleaf Admin",
      },
      "jwt-token",
    );

    expect(result).toEqual(successBody);
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "email already invited" }),
      }),
    );

    await expect(
      inviteUser(
        { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
        "jwt-token",
      ),
    ).rejects.toMatchObject({ message: "email already invited", status: 409 });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(
      inviteUser(
        { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
        "jwt-token",
      ),
    ).rejects.toMatchObject({ message: "Invite failed.", status: 500 });
  });
});

describe("resendInvite", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends userId as a JSON body (not a query param) with the token as a Bearer Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await resendInvite("user1", "jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/resendInvite$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(init.body)).toEqual({ userId: "user1" });
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await resendInvite("user1", "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with no value on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(resendInvite("user1", "jwt-token")).resolves.toBeUndefined();
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "user not found" }),
      }),
    );

    await expect(resendInvite("user1", "jwt-token")).rejects.toMatchObject({
      message: "user not found",
      status: 404,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(resendInvite("user1", "jwt-token")).rejects.toMatchObject({
      message: "Resend invite failed.",
      status: 500,
    });
  });
});

describe("createPoleIssue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const input = {
    poleNumber: "TESTSL1-1004",
    status: "Electrical Issue",
    problemDetails: "Testing pole issue creation",
  };

  it("sends poleNumber, status, and problemDetails as a JSON body, with the token as a Bearer Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await createPoleIssue(input, "jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/createPoleIssue$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await createPoleIssue(input, "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with no value on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(createPoleIssue(input, "jwt-token")).resolves.toBeUndefined();
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "pole not found" }),
      }),
    );

    await expect(createPoleIssue(input, "jwt-token")).rejects.toMatchObject({
      message: "pole not found",
      status: 404,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(createPoleIssue(input, "jwt-token")).rejects.toMatchObject({
      message: "Failed to report the issue.",
      status: 500,
    });
  });
});

describe("changeRole", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends userId as a JSON body with the token as a Bearer Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ userId: "user1", role: "Customer Admin", customerId: "cust-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await changeRole("user1", "jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/changeRole$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(init.body)).toEqual({ userId: "user1" });
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ userId: "user1", role: "User", customerId: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await changeRole("user1", "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with the updated userId/role/customerId on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: "7401b2ef-89cd-40c3-bb93-1b6c18f313b2",
          role: "Customer Admin",
          customerId: "recRXOKVBlGRpplTm",
        }),
      }),
    );

    await expect(changeRole("7401b2ef-89cd-40c3-bb93-1b6c18f313b2", "jwt-token")).resolves.toEqual({
      userId: "7401b2ef-89cd-40c3-bb93-1b6c18f313b2",
      role: "Customer Admin",
      customerId: "recRXOKVBlGRpplTm",
    });
  });

  it("throws an ApimError carrying the server's error message on failure (e.g. a non-admin caller)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "this action requires one of: Streetleaf Admin, Customer Admin",
        }),
      }),
    );

    await expect(changeRole("user1", "jwt-token")).rejects.toMatchObject({
      message: "this action requires one of: Streetleaf Admin, Customer Admin",
      status: 400,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(changeRole("user1", "jwt-token")).rejects.toMatchObject({
      message: "Change role failed.",
      status: 500,
    });
  });
});

describe("setPoleLights", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = {
    success: true,
    message: "Request successful",
    statusCode: "200",
    data: null,
  };

  it("sends projectId/brightness/time as a JSON body with the token as a Bearer Authorization header, for a project-level action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) });
    vi.stubGlobal("fetch", fetchMock);

    await setPoleLights({ projectId: "recpJR5VuDGIrKo5d", brightness: 50, time: 30 }, "jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/setPoleLights$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(init.headers["Ocp-Apim-Subscription-Key"]).toBeDefined();
    expect(JSON.parse(init.body)).toEqual({
      projectId: "recpJR5VuDGIrKo5d",
      brightness: 50,
      time: 30,
    });
  });

  it("sends gatewayCode/brightness/time for a gateway-level action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) });
    vi.stubGlobal("fetch", fetchMock);

    await setPoleLights({ gatewayCode: "GT13L94A2506283D", brightness: 50, time: 30 }, "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      gatewayCode: "GT13L94A2506283D",
      brightness: 50,
      time: 30,
    });
  });

  it("sends poleNumber/brightness/time for a pole-level action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) });
    vi.stubGlobal("fetch", fetchMock);

    await setPoleLights({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }, "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ poleNumber: "DRH-Orl", brightness: 50, time: 30 });
  });

  it("sends poleNumbers/brightness/time for a selected-poles action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) });
    vi.stubGlobal("fetch", fetchMock);

    await setPoleLights(
      { poleNumbers: ["DRH-Orl", "DUKE-AVE"], brightness: 50, time: 30 },
      "jwt-token",
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      poleNumbers: ["DRH-Orl", "DUKE-AVE"],
      brightness: 50,
      time: 30,
    });
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) });
    vi.stubGlobal("fetch", fetchMock);

    await setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with the server's success/message/statusCode/data on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(successBody) }),
    );

    await expect(
      setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token"),
    ).resolves.toEqual(successBody);
  });

  it("throws an ApimError carrying the server's message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => JSON.stringify({ message: "Pole is offline" }),
      }),
    );

    await expect(
      setPoleLights({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({ message: "Pole is offline", status: 409 });
  });

  it("also reads the 'error' field (not just 'message') — the real API uses 'error', matching every other endpoint in this app", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "brightness must be between 0 and 100" }),
      }),
    );

    await expect(
      setPoleLights({ poleNumber: "DRH-Orl", brightness: 150, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message: "brightness must be between 0 and 100",
      status: 400,
    });
  });

  it("shows a clear, actionable message for Leadsun's own rate-limit pattern (502 with error: 'Leadsun EDGE API request failed'), instead of dumping the raw JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: "Leadsun EDGE API request failed" }),
      }),
    );

    await expect(
      setPoleLights({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message:
        "The request was rejected — it's likely being rate-limited right now. Wait a few seconds and try again.",
      status: 502,
    });
  });

  it("does not apply the Leadsun rate-limit message to a differently-worded 502, falling back to the raw error text instead", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: "Upstream service unavailable" }),
      }),
    );

    await expect(
      setPoleLights({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({ message: "Upstream service unavailable", status: 502 });
  });

  it("includes the status and a snippet of the raw body when the error response isn't valid JSON (e.g. an HTML/plain-text page from a gateway failure like a 502)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => "<html><body>Bad Gateway</body></html>",
      }),
    );

    await expect(
      setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("502") as unknown as string,
      status: 502,
    });
    await expect(
      setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message: expect.stringContaining("Bad Gateway") as unknown as string,
    });
  });

  it("falls back to a generic message (with status) when the error response body is completely empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "" }),
    );

    await expect(
      setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message: "Set pole lights failed (500, empty response body).",
      status: 500,
    });
  });

  it("truncates a very long non-JSON error body rather than including it in full", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "x".repeat(5000) }),
    );

    await expect(
      setPoleLights({ projectId: "rec1", brightness: 50, time: 30 }, "jwt-token"),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^Set pole lights failed \(502\): x{200}$/) as unknown as string,
    });
  });
});

describe("deleteUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends userId as a query param (not a JSON body) with the token as a Bearer Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteUser("user1", "jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/deleteUser\?userId=user1$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(init.body).toBeUndefined();
  });

  it("URL-encodes the userId in the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteUser("user with space", "jwt-token");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("userId=user%20with%20space");
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await deleteUser("user1", "jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with no value on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(deleteUser("user1", "jwt-token")).resolves.toBeUndefined();
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "cannot delete the last admin" }),
      }),
    );

    await expect(deleteUser("user1", "jwt-token")).rejects.toMatchObject({
      message: "cannot delete the last admin",
      status: 409,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(deleteUser("user1", "jwt-token")).rejects.toMatchObject({
      message: "Delete failed.",
      status: 500,
    });
  });
});

describe("signIn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = {
    token: "jwt-token",
    user: {
      id: "6496D8A1-7A59-4673-9C29-BB522B94CD28",
      name: "Minh Tran",
      email: "minh@streetleaf.com",
      role: "Streetleaf Admin",
      customerId: null,
    },
  };

  it("posts email + password to /signIn", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await signIn("minh@streetleaf.com", "hunter2");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/signIn$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "minh@streetleaf.com", password: "hunter2" }));
  });

  it("includes customerId in the body when provided (debugging only)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await signIn("minh@streetleaf.com", "hunter2", "rec5uaHZMOGZGyVcY");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(
      JSON.stringify({
        email: "minh@streetleaf.com",
        password: "hunter2",
        customerId: "rec5uaHZMOGZGyVcY",
      }),
    );
  });

  it("omits customerId from the body entirely when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await signIn("minh@streetleaf.com", "hunter2");

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).not.toHaveProperty("customerId");
  });

  it("does not request caching/revalidation (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await signIn("minh@streetleaf.com", "hunter2");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("returns the token and user on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await signIn("minh@streetleaf.com", "hunter2");

    expect(result).toEqual(successBody);
  });

  it("throws an ApimError carrying the server's error message on invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid email or password" }),
      }),
    );

    await expect(signIn("minh@streetleaf.com", "wrong")).rejects.toMatchObject({
      message: "invalid email or password",
      status: 401,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(signIn("minh@streetleaf.com", "wrong")).rejects.toMatchObject({
      message: "Sign in failed.",
      status: 500,
    });
  });
});

describe("registerUser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.jwt",
    user: {
      id: "1445C5D1-37C2-43CF-9F82-6223F425B265",
      name: "Minh South Oak",
      email: "minh+1@streetleaf.com",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    },
  };

  it("posts the invite token and password to /registerUser", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await registerUser("52111603-53d7-4a99-a027-a105b4d527b5", "Pass.123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/registerUser$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      token: "52111603-53d7-4a99-a027-a105b4d527b5",
      password: "Pass.123",
    });
  });

  it("does not send an Authorization header (the invite token is the credential)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await registerUser("52111603-53d7-4a99-a027-a105b4d527b5", "Pass.123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await registerUser("52111603-53d7-4a99-a027-a105b4d527b5", "Pass.123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("returns the token and user on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await registerUser("52111603-53d7-4a99-a027-a105b4d527b5", "Pass.123");

    expect(result).toEqual(successBody);
  });

  it("throws an ApimError carrying the server's error message on an invalid/expired invite link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid or expired invite link" }),
      }),
    );

    await expect(registerUser("bad-token", "Pass.123")).rejects.toMatchObject({
      message: "invalid or expired invite link",
      status: 400,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(registerUser("bad-token", "Pass.123")).rejects.toMatchObject({
      message: "Registration failed.",
      status: 500,
    });
  });
});

describe("signOut", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /signOut with the token as a Bearer Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await signOut("jwt-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/signOut$/);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await signOut("jwt-token");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("resolves with no value on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(signOut("jwt-token")).resolves.toBeUndefined();
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "token expired" }),
      }),
    );

    await expect(signOut("jwt-token")).rejects.toMatchObject({
      message: "token expired",
      status: 401,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(signOut("jwt-token")).rejects.toMatchObject({
      message: "Sign out failed.",
      status: 500,
    });
  });
});

describe("forgotPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = { message: "If that email exists, a reset link has been sent." };

  it("posts the email to /forgotPassword", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await forgotPassword("minh+4@streetleaf.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/forgotPassword$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "minh+4@streetleaf.com" });
  });

  it("does not send an Authorization header (no signed-in user at this point)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await forgotPassword("minh+4@streetleaf.com");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await forgotPassword("minh+4@streetleaf.com");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("returns the generic message on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await forgotPassword("minh+4@streetleaf.com");

    expect(result).toEqual(successBody);
  });

  it("throws an ApimError carrying the server's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "malformed email" }),
      }),
    );

    await expect(forgotPassword("not-an-email")).rejects.toMatchObject({
      message: "malformed email",
      status: 400,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(forgotPassword("minh+4@streetleaf.com")).rejects.toMatchObject({
      message: "Something went wrong. Please try again.",
      status: 500,
    });
  });
});

describe("resetPassword", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successBody = { success: true };

  it("posts the reset token and new password to /resetPassword", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await resetPassword("b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", "Pass.123");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/resetPassword$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      token: "b442b6bd-4fb5-4d54-9cc3-aedc9ae76603",
      newPassword: "Pass.123",
    });
  });

  it("does not send an Authorization header (the reset token is the credential)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await resetPassword("b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", "Pass.123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does not request caching (this is a mutating call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => successBody });
    vi.stubGlobal("fetch", fetchMock);

    await resetPassword("b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", "Pass.123");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("returns success on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => successBody }));

    const result = await resetPassword("b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", "Pass.123");

    expect(result).toEqual({ success: true });
  });

  it("throws an ApimError carrying the server's error message on an invalid/expired reset link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid or expired reset link" }),
      }),
    );

    await expect(resetPassword("bad-token", "Pass.123")).rejects.toMatchObject({
      message: "invalid or expired reset link",
      status: 400,
    });
  });

  it("falls back to a generic message when the error body isn't the expected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => null }),
    );

    await expect(resetPassword("bad-token", "Pass.123")).rejects.toMatchObject({
      message: "Reset failed.",
      status: 500,
    });
  });
});
