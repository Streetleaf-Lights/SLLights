import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getCustomerMock, getProjectsMock, getVitalsMock } = vi.hoisted(() => ({
  getCustomerMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getVitalsMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    getCustomer: getCustomerMock,
    getProjectsForCustomer: getProjectsMock,
    getPoleVitalsForCustomer: getVitalsMock,
  };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const pole = {
  id: "pole1", poleNumber: "PAS-1", locationId: "L1", active: true, isOnline: true,
  installDate: "2026-03-02", lat: 27.95, long: -82.46, lastUpdate: "2026-10-01 12:00:00+00:00",
  batteryVoltage1: 12.8, batteryVoltage2: 12.7, lampPower1: 40, lampPower2: 38,
  batteryElecCurrent1: 1.1, batteryElecCurrent2: 1.0, solarBoardVoltage: 18.2, solarBoardElecCurrent: 2.3,
  isLedFault: false, isBatteryFault: true, isPanelFault: false, isOpenIssueFault: true, isPoleFault: true,
  avgBatteryPercentage: 80, avgPanelPercentage: 70, avgLightPercentage: 95,
  sunsetTime: null, lightStatusText: "ON", panelStatusText: "Charging", panelIdleReason: null,
  batteryStatusText: "Low", electricCurrentAverage: 55, connectedText: "Online", overallStatusText: "Fault",
  poleIssues: [{ issueId: "i1", status: "Open", poleStatus: "", dateReported: "2026-09-30", problemDetails: "Flicker" }],
};

const prime = () => {
  getCustomerMock.mockResolvedValue({ id: "c1", name: "Coastal Power", projects: [], address: null, city: null, state: null, zip: null, phone: null, active: true });
  getProjectsMock.mockResolvedValue([{ id: "p1", name: "North", leadsunProject: null, active: true }]);
  getVitalsMock.mockResolvedValue({ projects: [{ id: "p1", name: "North", poles: [pole] }] });
};

const path = (c = "c1", p = "p1", pl = "pole1") => `/api/mobile/customers/${c}/projects/${p}/poles/${pl}`;
const call = (token: string | null, c = "c1", p = "p1", pl = "pole1") =>
  GET(new NextRequest(`http://localhost${path(c, p, pl)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }), {
    params: Promise.resolve({ customerId: c, projectId: p, poleId: pl }),
  });

afterEach(() => [getCustomerMock, getProjectsMock, getVitalsMock].forEach((m) => m.mockReset()));

describe("GET /api/mobile/customers/{c}/projects/{p}/poles/{poleId}", () => {
  it("returns the full staff view: header, 48H overall status, detailed cards, issues", async () => {
    prime();
    const res = await call(staff);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customer).toEqual({ id: "c1", name: "Coastal Power" });
    expect(body.project).toEqual({ id: "p1", name: "North", active: true });
    expect(body.pole).toMatchObject({
      poleNumber: "PAS-1",
      connection: { text: "Online", tone: "active" },
      overallStatusText: "Fault",
      lat: 27.95,
      issues: [{ issueId: "i1" }],
    });
    const battery = body.pole.cards.find((c: { id: string }) => c.id === "battery");
    expect(battery.status).toEqual({ text: "Fault", tone: "flagged" });
    expect(battery.metrics.map((m: { label: string }) => m.label)).toContain("Battery Voltage 2");
  });

  it("sends customer-scoped viewers only what the web shows them", async () => {
    prime();
    const body = await (await call(ownerC1)).json();
    expect(body.pole).not.toHaveProperty("overallStatusText");
    const battery = body.pole.cards.find((c: { id: string }) => c.id === "battery");
    expect(battery.metrics.map((m: { label: string }) => m.label)).toEqual(["Operating Status", "Battery Percentage"]);
    // No raw telemetry anywhere in the response.
    const json = JSON.stringify(body);
    for (const hidden of ["12.8V", "18.2V", "batteryVoltage", "lampPower", "48H"]) expect(json).not.toContain(hidden);
  });

  it("404s another customer's pole for a customer-scoped token, without calling APIM", async () => {
    expect((await call(ownerC1, "c2")).status).toBe(404);
    expect(getVitalsMock).not.toHaveBeenCalled();
  });

  it("404s an unknown project or pole", async () => {
    prime();
    expect((await call(staff, "c1", "p9")).status).toBe(404);
    expect((await call(staff, "c1", "p1", "nope")).status).toBe(404);
  });

  it.each([
    ["missing", null],
    ["malformed", "not.a.jwt"],
    ["expired", expired],
  ])("401s a %s token", async (_label, token) => {
    expect((await call(token)).status).toBe(401);
    expect(getVitalsMock).not.toHaveBeenCalled();
  });

  it("passes APIM errors through and hides unexpected ones", async () => {
    getCustomerMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    getProjectsMock.mockResolvedValue([]);
    getVitalsMock.mockResolvedValue(undefined);
    expect((await call(staff)).status).toBe(503);
    getCustomerMock.mockRejectedValueOnce(new Error("boom"));
    const res = await call(staff);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Couldn't load this pole. Please try again.");
  });
});
