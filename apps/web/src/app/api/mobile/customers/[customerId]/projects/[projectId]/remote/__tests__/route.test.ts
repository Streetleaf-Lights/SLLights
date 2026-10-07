import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { projectsMock, setLightsMock, lampStatusMock } = vi.hoisted(() => ({
  projectsMock: vi.fn(),
  setLightsMock: vi.fn(),
  lampStatusMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getProjectsForCustomer: projectsMock, setPoleLights: setLightsMock };
});
vi.mock("@/lib/leadsunClient", () => ({ fetchLeadsunLampStatus: lampStatusMock }));

import { ApimError } from "@/lib/apim";
import { GET, POST } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/remote/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const staff = testToken({ sub: "a1", role: "Streetleaf Admin", exp });
const ownerC1 = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const expired = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: 1 });

const leadsunProject = {
  ProjectId: "LS-77",
  ProjectName: "North (Leadsun)",
  totalGateways: 2,
  totalPoles: 3,
  groups: [
    { GroupId: 1, GroupName: "Gateway A", GatewayCode: "GW-A", totalPoles: 2, products: [
      { ProductId: 1, ProductName: "LOC-1", ProvidedProductId: "AEX-1", PoleNumber: "PAS-1" },
      { ProductId: 2, ProductName: "LOC-2", ProvidedProductId: "AEX-2", PoleNumber: "PAS-2" },
    ] },
    { GroupId: 2, GroupName: "Gateway B", GatewayCode: "GW-B", totalPoles: 1, products: [
      { ProductId: 3, ProductName: "LOC-3", ProvidedProductId: "AEX-3", PoleNumber: "PAS-3" },
    ] },
  ],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  projectsMock.mockResolvedValue([
    { id: "p1", name: "North", active: true, leadsunProject },
    { id: "p2", name: "No Leadsun", active: true, leadsunProject: null },
  ]);
  lampStatusMock.mockResolvedValue([
    { productId: "AEX-1", lampPower1: 10, lampPower2: 0 },
    { productId: "AEX-2", lampPower1: 0, lampPower2: 0 },
  ]);
  setLightsMock.mockResolvedValue({ success: true, message: "Request successful", statusCode: "200", data: null });
});
afterEach(() => {
  vi.restoreAllMocks();
  [projectsMock, setLightsMock, lampStatusMock].forEach((m) => m.mockReset());
});

const url = (c: string, p: string) => `http://localhost/api/mobile/customers/${c}/projects/${p}/remote`;
const ctx = (c: string, p: string) => ({ params: Promise.resolve({ customerId: c, projectId: p }) });
const authH = (t: string | null): Record<string, string> => (t ? { authorization: `Bearer ${t}` } : {});
const get = (t: string | null, c = "c1", p = "p1") => GET(new NextRequest(url(c, p), { headers: authH(t) }), ctx(c, p));
const post = (t: string | null, body: unknown, c = "c1", p = "p1") =>
  POST(
    new NextRequest(url(c, p), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authH(t) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    ctx(c, p),
  );
const cmd = (target: unknown) => ({ brightness: 60, time: 30, target });

describe("GET …/projects/{projectId}/remote", () => {
  it("returns the gateways and lights with live state", async () => {
    const body = await (await get(ownerC1)).json();
    expect(body.remote.projectName).toBe("North (Leadsun)");
    expect(body.remote.gateways.map((g: { code: string }) => g.code)).toEqual(["GW-A", "GW-B"]);
    expect(body.remote.gateways[0].lights).toEqual([
      { poleNumber: "PAS-1", productName: "LOC-1", providedProductId: "AEX-1", lamp: "on" },
      { poleNumber: "PAS-2", productName: "LOC-2", providedProductId: "AEX-2", lamp: "off" },
    ]);
    expect(body.remote.gateways[1].lights[0].lamp).toBe("unknown"); // not listed by Leadsun
    expect(lampStatusMock).toHaveBeenCalledWith("LS-77");
  });

  it("keeps Leadsun's failure detail off the phone", async () => {
    lampStatusMock.mockRejectedValueOnce(new Error("cert expired"));
    const body = await (await get(staff)).json();
    expect(body.remote.statusError).toBe("Couldn't load live ON/OFF status.");
    expect(JSON.stringify(body)).not.toContain("cert");
  });

  it("returns null for a project without Leadsun lights", async () => {
    expect(await (await get(staff, "c1", "p2")).json()).toEqual({ remote: null });
  });

  it("404s another customer's project or an unknown project, without asking Leadsun", async () => {
    expect((await get(ownerC1, "c2")).status).toBe(404);
    expect((await get(staff, "c1", "p9")).status).toBe(404);
    expect(lampStatusMock).not.toHaveBeenCalled();
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token", async (_l, t) => {
    expect((await get(t)).status).toBe(401);
  });
});

describe("POST …/projects/{projectId}/remote", () => {
  it("switches the whole project by this project's own id, ignoring any id in the request", async () => {
    await post(ownerC1, cmd({ kind: "project", projectId: "someone-elses" }));
    expect(setLightsMock).toHaveBeenCalledWith({ projectId: "p1", brightness: 60, time: 30 }, ownerC1);
  });

  it("switches one of this project's gateways", async () => {
    await post(staff, cmd({ kind: "gateway", gatewayCode: "GW-B" }));
    expect(setLightsMock).toHaveBeenCalledWith({ gatewayCode: "GW-B", brightness: 60, time: 30 }, staff);
  });

  it("switches one light, or chosen lights, of this project", async () => {
    await post(staff, cmd({ kind: "lights", productNames: ["LOC-2"] }));
    expect(setLightsMock).toHaveBeenLastCalledWith({ poleNumber: "LOC-2", brightness: 60, time: 30 }, staff);
    await post(staff, cmd({ kind: "lights", productNames: ["LOC-1", "LOC-3"] }));
    expect(setLightsMock).toHaveBeenLastCalledWith({ poleNumbers: ["LOC-1", "LOC-3"], brightness: 60, time: 30 }, staff);
  });

  it("refuses a gateway or light that isn't part of this project", async () => {
    expect((await post(staff, cmd({ kind: "gateway", gatewayCode: "GW-SOMEONE-ELSE" }))).status).toBe(404);
    expect((await post(staff, cmd({ kind: "lights", productNames: ["LOC-1", "OTHER-CUSTOMER-LIGHT"] }))).status).toBe(404);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it("404s another customer's project, an unknown one, or one without Leadsun lights", async () => {
    expect((await post(ownerC1, cmd({ kind: "project" }), "c2")).status).toBe(404);
    expect((await post(staff, cmd({ kind: "project" }), "c1", "p9")).status).toBe(404);
    expect((await post(staff, cmd({ kind: "project" }), "c1", "p2")).status).toBe(404);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["no target", { brightness: 50, time: 30 }],
    ["bad brightness", { brightness: -5, time: 30, target: { kind: "project" } }],
  ])("400s %s, without touching any light", async (_l, body) => {
    expect((await post(staff, body)).status).toBe(400);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token without touching any light", async (_l, t) => {
    expect((await post(t, cmd({ kind: "project" }))).status).toBe(401);
    expect(setLightsMock).not.toHaveBeenCalled();
  });

  it("reports a command Leadsun didn't accept, and APIM errors", async () => {
    setLightsMock.mockResolvedValueOnce({ success: false, message: "Leadsun EDGE API request failed" });
    expect((await post(staff, cmd({ kind: "project" }))).status).toBe(502);
    setLightsMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    expect((await post(staff, cmd({ kind: "project" }))).status).toBe(503);
  });
});
