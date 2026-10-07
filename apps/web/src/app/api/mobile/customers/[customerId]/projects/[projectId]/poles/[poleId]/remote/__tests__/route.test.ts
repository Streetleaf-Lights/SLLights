import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { projectsMock, vitalsMock, setLightsMock, lampStatusMock } = vi.hoisted(() => ({
  projectsMock: vi.fn(),
  vitalsMock: vi.fn(),
  setLightsMock: vi.fn(),
  lampStatusMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getProjectsForCustomer: projectsMock, getPoleVitalsForCustomer: vitalsMock, setPoleLights: setLightsMock };
});
vi.mock("@/lib/leadsunClient", () => ({ fetchLeadsunLampStatus: lampStatusMock }));

import { ApimError } from "@/lib/apim";
import { GET, POST } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/remote/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const leadsunProject = {
  ProjectId: "LS-77",
  ProjectName: "North",
  totalGateways: 1,
  totalPoles: 2,
  groups: [
    {
      GroupId: 1,
      GroupName: "Gateway A",
      GatewayCode: "GW-A",
      totalPoles: 2,
      products: [
        { ProductId: 1, ProductName: "LOC-1", ProvidedProductId: "AEX-1", PoleNumber: "PAS-1" },
        { ProductId: 2, ProductName: "LOC-2", ProvidedProductId: "AEX-2", PoleNumber: "PAS-2" },
      ],
    },
  ],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  projectsMock.mockResolvedValue([{ id: "p1", name: "North", active: true, leadsunProject }]);
  vitalsMock.mockResolvedValue({
    projects: [{ id: "p1", poles: [{ id: "pole1", locationId: "LOC-1" }, { id: "pole9", locationId: "NOT-IN-LEADSUN" }] }],
  });
  lampStatusMock.mockResolvedValue([{ productId: "AEX-1", lampPower1: 12, lampPower2: 0 }]);
  setLightsMock.mockResolvedValue({ success: true, message: "Request successful", statusCode: "200", data: null });
});
afterEach(() => {
  vi.restoreAllMocks();
  [projectsMock, vitalsMock, setLightsMock, lampStatusMock].forEach((m) => m.mockReset());
});

const path = (c: string, p: string, pole: string) => `http://localhost/api/mobile/customers/${c}/projects/${p}/poles/${pole}/remote`;
const ctx = (c: string, p: string, pole: string) => ({ params: Promise.resolve({ customerId: c, projectId: p, poleId: pole }) });
const auth = (token: string | null): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

const get = (token: string | null, c = "c1", p = "p1", pole = "pole1") =>
  GET(new NextRequest(path(c, p, pole), { headers: auth(token) }), ctx(c, p, pole));
const post = (token: string | null, body: unknown, c = "c1", p = "p1", pole = "pole1") =>
  POST(
    new NextRequest(path(c, p, pole), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(c, p, pole),
  );

describe("GET …/remote", () => {
  it("returns the pole's Leadsun identity and live state", async () => {
    const res = await get(ownerC1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      remote: { productName: "LOC-1", providedProductId: "AEX-1", gatewayName: "Gateway A", lamp: "on", statusError: null },
    });
    expect(lampStatusMock).toHaveBeenCalledWith("LS-77", "AEX-1");
  });

  it("reports OFF when both channels draw nothing, unknown when Leadsun doesn't list the lamp", async () => {
    lampStatusMock.mockResolvedValueOnce([{ productId: "AEX-1", lampPower1: 0, lampPower2: 0 }]);
    expect((await (await get(staff)).json()).remote.lamp).toBe("off");
    lampStatusMock.mockResolvedValueOnce([]);
    expect((await (await get(staff)).json()).remote.lamp).toBe("unknown");
  });

  it("keeps Leadsun's failure detail off the phone", async () => {
    lampStatusMock.mockRejectedValueOnce(new Error("LEADSUN_CLIENT_CERT_PEM is not configured"));
    const body = await (await get(staff)).json();
    expect(body.remote).toMatchObject({ lamp: "unknown", statusError: "Couldn't load live ON/OFF status." });
    expect(JSON.stringify(body)).not.toContain("CERT");
  });

  it("returns remote: null for a pole with no Leadsun product", async () => {
    expect(await (await get(staff, "c1", "p1", "pole9")).json()).toEqual({ remote: null });
    expect(lampStatusMock).not.toHaveBeenCalled();
  });

  it("404s another customer's pole, or a pole not in this project, without asking Leadsun", async () => {
    expect((await get(ownerC1, "c2")).status).toBe(404);
    expect((await get(staff, "c1", "p1", "someone-elses")).status).toBe(404);
    expect((await get(staff, "c1", "p9")).status).toBe(404);
    expect(lampStatusMock).not.toHaveBeenCalled();
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token", async (_l, token) => {
    expect((await get(token)).status).toBe(401);
    expect(projectsMock).not.toHaveBeenCalled();
  });
});

describe("POST …/remote", () => {
  it("switches this pole's own lamp", async () => {
    const res = await post(ownerC1, { brightness: 80, time: 60 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: "Request successful" });
    expect(setLightsMock).toHaveBeenCalledWith({ poleNumber: "LOC-1", brightness: 80, time: 60 }, ownerC1);
  });

  it("ignores any other target named in the body", async () => {
    await post(staff, { brightness: 0, time: 30, projectId: "p-other", gatewayCode: "GW-X", poleNumber: "LOC-2", poleNumbers: ["LOC-2"] });
    expect(setLightsMock).toHaveBeenCalledTimes(1);
    expect(setLightsMock).toHaveBeenCalledWith({ poleNumber: "LOC-1", brightness: 0, time: 30 }, staff);
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["brightness out of range", { brightness: 150, time: 30 }],
    ["time out of range", { brightness: 50, time: 0 }],
    ["missing time", { brightness: 50 }],
  ])("400s %s, without touching any light", async (_l, body) => {
    expect((await post(staff, body)).status).toBe(400);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it("404s another customer's pole, a pole not in this project, or one without remote control", async () => {
    expect((await post(ownerC1, { brightness: 50, time: 30 }, "c2")).status).toBe(404);
    expect((await post(staff, { brightness: 50, time: 30 }, "c1", "p1", "someone-elses")).status).toBe(404);
    const noProduct = await post(staff, { brightness: 50, time: 30 }, "c1", "p1", "pole9");
    expect(noProduct.status).toBe(404);
    expect((await noProduct.json()).error).toBe("This pole has no remote control.");
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token without touching any light", async (_l, token) => {
    expect((await post(token, { brightness: 50, time: 30 })).status).toBe(401);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it("reports a command Leadsun didn't accept, and APIM errors", async () => {
    setLightsMock.mockResolvedValueOnce({ success: false, message: "Leadsun EDGE API request failed", statusCode: "502", data: null });
    const rejected = await post(staff, { brightness: 50, time: 30 });
    expect(rejected.status).toBe(502);
    expect((await rejected.json()).error).toBe("Leadsun EDGE API request failed");
    setLightsMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    expect((await post(staff, { brightness: 50, time: 30 })).status).toBe(503);
  });
});
