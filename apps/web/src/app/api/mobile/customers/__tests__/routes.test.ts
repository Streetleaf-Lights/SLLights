import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getCustomersMock, getCustomerMock, getProjectsMock, getVitalsMock } = vi.hoisted(() => ({
  getCustomersMock: vi.fn(),
  getCustomerMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getVitalsMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    getCustomers: getCustomersMock,
    getCustomer: getCustomerMock,
    getProjectsForCustomer: getProjectsMock,
    getPoleVitalsForCustomer: getVitalsMock,
  };
});

import { ApimError } from "@/lib/apim";
import { GET as listCustomers } from "@/app/api/mobile/customers/route";
import { GET as getOverview } from "@/app/api/mobile/customers/[customerId]/route";
import { GET as getProject } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const req = (path: string, token: string | null) =>
  new NextRequest(`http://localhost${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

const customer = { id: "c1", name: "Coastal Power", projects: [], address: null, city: null, state: null, zip: null, phone: null, active: true };
const projects = [{ id: "p1", name: "North", leadsunProject: null, active: true }];
const vitals = {
  id: "c1", name: "Coastal Power", totalLights: 2, connectedLights: 2, totalFaults: 0, percentWorking: 100, poles: [],
  projects: [{ id: "p1", name: "North", totalLights: 2, connectedLights: 2, totalFaults: 0, percentWorking: 100, poles: [] }],
};

function primeCustomerData() {
  getCustomerMock.mockResolvedValue(customer);
  getProjectsMock.mockResolvedValue(projects);
  getVitalsMock.mockResolvedValue(vitals);
}

afterEach(() => {
  for (const mock of [getCustomersMock, getCustomerMock, getProjectsMock, getVitalsMock]) mock.mockReset();
});

describe("GET /api/mobile/customers", () => {
  it("lists active customers by name for Streetleaf staff", async () => {
    getCustomersMock.mockResolvedValue([
      { ...customer, id: "c2", name: "Zephyr Lighting" },
      { ...customer, id: "c1", name: "Acme" },
    ]);
    const res = await listCustomers(req("/api/mobile/customers", staff));
    expect(await res.json()).toEqual({ customers: [{ id: "c1", name: "Acme" }, { id: "c2", name: "Zephyr Lighting" }] });
    expect(getCustomersMock).toHaveBeenCalledWith({ active: true }, staff);
  });

  it("is forbidden to customer-scoped users, without calling APIM", async () => {
    expect((await listCustomers(req("/api/mobile/customers", ownerC1))).status).toBe(403);
    expect(getCustomersMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["malformed", "not.a.jwt"],
    ["expired", expired],
  ])("401s for a %s token", async (_label, token) => {
    expect((await listCustomers(req("/api/mobile/customers", token))).status).toBe(401);
    expect(getCustomersMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/mobile/customers/{customerId}", () => {
  it("returns the overview for the caller's own customer", async () => {
    primeCustomerData();
    const res = await getOverview(req("/api/mobile/customers/c1", ownerC1), ctx({ customerId: "c1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer.name).toBe("Coastal Power");
    expect(body.projects).toHaveLength(1);
    expect(getVitalsMock).toHaveBeenCalledWith("c1", ownerC1);
  });

  it("404s a customer-scoped token asking for another customer, without calling APIM", async () => {
    const res = await getOverview(req("/api/mobile/customers/c2", ownerC1), ctx({ customerId: "c2" }));
    expect(res.status).toBe(404);
    expect(getCustomerMock).not.toHaveBeenCalled();
    expect(getVitalsMock).not.toHaveBeenCalled();
  });

  it("lets staff load any customer, and 404s one that doesn't exist", async () => {
    primeCustomerData();
    expect((await getOverview(req("/api/mobile/customers/c1", staff), ctx({ customerId: "c1" }))).status).toBe(200);
    getCustomerMock.mockResolvedValue(undefined);
    expect((await getOverview(req("/api/mobile/customers/zz", staff), ctx({ customerId: "zz" }))).status).toBe(404);
  });

  it("401s without a valid token", async () => {
    expect((await getOverview(req("/api/mobile/customers/c1", null), ctx({ customerId: "c1" }))).status).toBe(401);
    expect((await getOverview(req("/api/mobile/customers/c1", expired), ctx({ customerId: "c1" }))).status).toBe(401);
  });

  it("passes APIM errors through", async () => {
    getCustomerMock.mockRejectedValue(new ApimError("APIM request failed", 503));
    getProjectsMock.mockResolvedValue([]);
    getVitalsMock.mockResolvedValue(undefined);
    expect((await getOverview(req("/api/mobile/customers/c1", ownerC1), ctx({ customerId: "c1" }))).status).toBe(503);
  });
});

describe("GET /api/mobile/customers/{customerId}/projects/{projectId}", () => {
  const path = (c: string, p: string) => `/api/mobile/customers/${c}/projects/${p}`;

  it("returns project stats and poles for the caller's own customer", async () => {
    primeCustomerData();
    const res = await getProject(req(path("c1", "p1"), ownerC1), ctx({ customerId: "c1", projectId: "p1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ project: { id: "p1", name: "North", totalLights: 2 }, poles: [] });
  });

  it("404s another customer's project for a customer-scoped token, without calling APIM", async () => {
    const res = await getProject(req(path("c2", "p9"), ownerC1), ctx({ customerId: "c2", projectId: "p9" }));
    expect(res.status).toBe(404);
    expect(getProjectsMock).not.toHaveBeenCalled();
  });

  it("404s a project id that isn't in this customer", async () => {
    primeCustomerData();
    const res = await getProject(req(path("c1", "p9"), ownerC1), ctx({ customerId: "c1", projectId: "p9" }));
    expect(res.status).toBe(404);
  });

  it("hides unexpected failures behind a generic message", async () => {
    getCustomerMock.mockRejectedValue(new Error("socket hang up"));
    getProjectsMock.mockResolvedValue([]);
    getVitalsMock.mockResolvedValue(undefined);
    const res = await getProject(req(path("c1", "p1"), staff), ctx({ customerId: "c1", projectId: "p1" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Couldn't load this project. Please try again.");
  });
});
