import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getPolesMock, projectsMock, customerMock } = vi.hoisted(() => ({
  getPolesMock: vi.fn(),
  projectsMock: vi.fn(),
  customerMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getPoles: getPolesMock, getProjectsForCustomer: projectsMock, getCustomer: customerMock };
});

import { ApimError } from "@/lib/apim";
import { clearPolesCache } from "@/lib/mobile-poles";
import { GET } from "@/app/api/mobile/poles/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "+00:00");
const stale = "2020-01-01 00:00:00+00:00";

const pole = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `id${n}`,
  poleNumber: `PAS-${n}`,
  customerId: "c1",
  projectId: "p1",
  isOnline: true,
  connectedText: "Online",
  overallStatusText: "OK",
  lightStatusText: "ON",
  panelStatusText: "Idle",
  panelIdleReason: "Night",
  batteryStatusText: "Charging",
  isPoleFault: false,
  lastUpdate: recent,
  ...extra,
});

const call = (token: string | null, query = "") =>
  GET(new NextRequest(`http://localhost/api/mobile/poles${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));

beforeEach(() => {
  clearPolesCache();
  getPolesMock.mockResolvedValue(Array.from({ length: 23 }, (_, i) => pole(i + 1)));
  projectsMock.mockResolvedValue([
    { id: "p1", name: "North", active: true, leadsunProject: null },
    { id: "p2", name: "South", active: true, leadsunProject: null },
  ]);
  customerMock.mockResolvedValue({ id: "c1", name: "Coastal Power" });
});
afterEach(() => [getPolesMock, projectsMock, customerMock].forEach((m) => m.mockReset()));

describe("GET /api/mobile/poles — all poles", () => {
  it("pages 10 at a time, with the web's columns for staff", async () => {
    const body = await (await call(staff, "?page=2")).json();
    expect(body).toMatchObject({ page: 2, totalPages: 3, totalItems: 23, firstItem: 11, lastItem: 20 });
    expect(body.rows).toHaveLength(10);
    expect(body.rows[0]).toEqual({
      id: "id11",
      poleNumber: "PAS-11",
      customerId: "c1",
      projectId: "p1",
      isOnline: true,
      connectedText: "Online",
      overallStatusText: "OK",
      lightStatusText: "ON",
      panelText: "Idle (Night)",
      batteryStatusText: "Charging",
    });
    expect(getPolesMock).toHaveBeenCalledWith(undefined, staff); // staff: every pole
  });

  it("searches by pole number (case-insensitive) and starts again from a valid page", async () => {
    const body = await (await call(staff, "?q=pas-1&page=9")).json();
    expect(body.totalItems).toBe(11); // PAS-1, PAS-10..19
    expect(body.page).toBe(2); // clamped
  });

  it("scopes a customer to their own poles, without 48h Connected", async () => {
    getPolesMock.mockResolvedValue([pole(1), pole(2, { customerId: "c2" })]); // as if APIM ignored the filter
    const body = await (await call(ownerC1)).json();
    expect(getPolesMock).toHaveBeenCalledWith({ customerId: "c1" }, ownerC1);
    expect(body.rows.map((r: { poleNumber: string }) => r.poleNumber)).toEqual(["PAS-1"]);
    expect(body.rows[0]).not.toHaveProperty("connectedText");
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token", async (_l, t) => {
    expect((await call(t)).status).toBe(401);
    expect(getPolesMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/mobile/poles — faults view", () => {
  beforeEach(() => {
    getPolesMock.mockResolvedValue([
      pole(1, { isPoleFault: true }),
      pole(2, { isPoleFault: true, projectId: "p2" }),
      pole(3, { isPoleFault: true, lastUpdate: stale }), // stale: excluded
      pole(4, { isPoleFault: false }),
      pole(5, { isPoleFault: true, lastUpdate: null }), // never reported: excluded
    ]);
  });

  it("lists faulted, recently-reporting poles with their project, and the customer for staff", async () => {
    const body = await (await call(staff, "?faults=1&customerId=c1")).json();
    expect(body.rows.map((r: { poleNumber: string; projectName: string }) => [r.poleNumber, r.projectName])).toEqual([
      ["PAS-1", "North"],
      ["PAS-2", "South"],
    ]);
    expect(body.customerName).toBe("Coastal Power");
  });

  it("narrows to one project", async () => {
    const body = await (await call(ownerC1, "?faults=1&customerId=c1&projectId=p2")).json();
    expect(body.rows.map((r: { poleNumber: string }) => r.poleNumber)).toEqual(["PAS-2"]);
    expect(body).not.toHaveProperty("customerName"); // customers don't get the Customer column
  });

  it("404s another customer's faults, or a project that isn't theirs", async () => {
    expect((await call(ownerC1, "?faults=1&customerId=c2")).status).toBe(404);
    expect((await call(ownerC1, "?faults=1&customerId=c1&projectId=p-other")).status).toBe(404);
  });

  it("400s a faults request without a customer", async () => {
    expect((await call(staff, "?faults=1")).status).toBe(400);
  });
});

describe("the per-scope cache", () => {
  it("reuses a scope's list for repeat requests, so paging doesn't re-download every pole", async () => {
    await call(staff, "?page=1");
    await call(staff, "?page=2");
    await call(staff, "?q=pas");
    expect(getPolesMock).toHaveBeenCalledTimes(1);
  });

  it("never serves one customer the staff (all-poles) list, or another customer's", async () => {
    getPolesMock.mockImplementation(async (filters?: { customerId?: string }) =>
      filters?.customerId ? [pole(1, { customerId: filters.customerId })] : [pole(1), pole(2, { customerId: "c2" })],
    );
    await call(staff); // fills "all"
    const body = await (await call(ownerC1)).json();
    expect(getPolesMock).toHaveBeenLastCalledWith({ customerId: "c1" }, ownerC1);
    expect(body.rows.every((r: { customerId: string }) => r.customerId === "c1")).toBe(true);
  });

  it("doesn't keep a failed fetch", async () => {
    getPolesMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    expect((await call(staff)).status).toBe(503);
    expect((await call(staff)).status).toBe(200);
    expect(getPolesMock).toHaveBeenCalledTimes(2);
  });
});
