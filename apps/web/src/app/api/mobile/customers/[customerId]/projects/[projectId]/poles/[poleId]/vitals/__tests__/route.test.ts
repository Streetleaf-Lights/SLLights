import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getVitalsMock, getHistoryMock } = vi.hoisted(() => ({ getVitalsMock: vi.fn(), getHistoryMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getPoleVitalsForCustomer: getVitalsMock, getPoleVitalsByPeriod: getHistoryMock };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/vitals/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const history = [{ periodStart: "2026-10-01 00:00:00-04:00", avgLightPercentage: 0, avgPanelPercentage: 0, avgBatteryPercentage: 80 }];

function call(token: string | null, { c = "c1", p = "p1", pole = "pole1", days = "2" } = {}) {
  const url = `http://localhost/api/mobile/customers/${c}/projects/${p}/poles/${pole}/vitals${days === "" ? "" : `?days=${days}`}`;
  return GET(new NextRequest(url, { headers: token ? { authorization: `Bearer ${token}` } : {} }), {
    params: Promise.resolve({ customerId: c, projectId: p, poleId: pole }),
  });
}

const prime = () => {
  getVitalsMock.mockResolvedValue({ projects: [{ id: "p1", poles: [{ id: "pole1" }] }] });
  getHistoryMock.mockResolvedValue({ vitals: history });
};

afterEach(() => [getVitalsMock, getHistoryMock].forEach((m) => m.mockReset()));

describe("GET …/poles/{poleId}/vitals", () => {
  it("returns hourly vitals for the requested number of days", async () => {
    prime();
    const res = await call(ownerC1, { days: "7" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ vitals: history });
    expect(getHistoryMock).toHaveBeenCalledWith({ poleId: "pole1", periodType: "Hour", limit: 168, token: ownerC1 });
  });

  it.each(["", "3", "0", "-2", "abc", "365"])("400s days=%j, without calling APIM", async (days) => {
    expect((await call(staff, { days })).status).toBe(400);
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it("404s another customer's pole for a customer-scoped token, without calling APIM", async () => {
    expect((await call(ownerC1, { c: "c2" })).status).toBe(404);
    expect(getVitalsMock).not.toHaveBeenCalled();
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it("404s a pole id that isn't in this customer's project, before fetching its history", async () => {
    prime();
    expect((await call(staff, { pole: "someone-elses-pole" })).status).toBe(404);
    expect((await call(staff, { p: "p9" })).status).toBe(404);
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["malformed", "not.a.jwt"],
    ["expired", expired],
  ])("401s a %s token, without calling APIM", async (_label, token) => {
    expect((await call(token)).status).toBe(401);
    expect(getVitalsMock).not.toHaveBeenCalled();
    expect(getHistoryMock).not.toHaveBeenCalled();
  });

  it("passes APIM errors through and hides unexpected ones", async () => {
    prime();
    getHistoryMock.mockRejectedValueOnce(new ApimError("Failed to load pole vitals.", 502));
    expect((await call(staff)).status).toBe(502);
    getHistoryMock.mockRejectedValueOnce(new Error("socket hang up"));
    const res = await call(staff);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Couldn't load vitals history. Please try again.");
  });
});
