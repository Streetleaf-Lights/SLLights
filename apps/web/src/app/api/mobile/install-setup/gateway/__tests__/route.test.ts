import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const m = vi.hoisted(() => ({ getAllProjects: vi.fn(), getPolesPage: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidateTag }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getAllProjects: m.getAllProjects, getPolesPage: m.getPolesPage };
});

import { POST } from "@/app/api/mobile/install-setup/gateway/route";
import { GET as GATEWAY_POLES } from "@/app/api/mobile/install-setup/gateway-poles/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const crew = testToken({ sub: "crew1", role: "Streetleaf Crew", exp });
const leadsun = (groups: { GatewayCode: string; GroupName: string }[] = []) => ({
  ProjectId: "751",
  ProjectName: "Streetleaf - SL1 Test",
  totalGateways: groups.length,
  totalPoles: 0,
  groups: groups.map((g, i) => ({ GroupId: 1890 + i, totalPoles: 0, products: [], ...g })),
});
const project = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: "Streetleaf - SL1 Test",
  customerId: "c1",
  active: true,
  stickerNumbers: ["S-1"],
  leadsunProject: leadsun(),
  ...extra,
});
const pole = (poleNumber: string, isGateway: boolean, projectId = "p1") => ({ id: `id-${poleNumber}`, poleNumber, isGateway, projectId, customerId: "c1" });
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        projectId: "p1",
        leadsunProject: leadsun([{ GatewayCode: "GT12L94A24072662", GroupName: "TESTSL1-1001 Streetleaf - SL1 Test" }]),
      }),
      { status: 201 },
    ),
  );
  m.getAllProjects.mockResolvedValue([
    project("p1"),
    project("p-new", { leadsunProject: null }),
    project("p-done", { leadsunProject: leadsun([{ GatewayCode: "GW-1", GroupName: "TESTSL1-1001 Streetleaf - SL1 Test" }]) }),
  ]);
  m.getPolesPage.mockImplementation(async ({ projectId }: { projectId: string }) => {
    const items = [pole("TESTSL1-1001", true, projectId), pole("TESTSL1-1002", false, projectId), pole("OTHER-1", true, "elsewhere")];
    return { total: items.length, page: 1, pageSize: 1000, items };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  Object.values(m).forEach((f) => f.mockReset());
});

const post = (body: unknown, token: string | null = crew) =>
  POST(
    new NextRequest("http://localhost/api/mobile/install-setup/gateway", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const good = { projectId: "p1", poleNumber: "TESTSL1-1001", gatewaySerial: " AEXSAM2324070259 " };

describe("POST /api/mobile/install-setup/gateway (Register gateway)", () => {
  it("registers via populateLeadsunGateway, from our records, and returns the gateways", async () => {
    const res = await post({ ...good, leadsunProjectId: "999", groupName: "made up" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      projectId: "p1",
      gateways: [{ code: "GT12L94A24072662", name: "TESTSL1-1001 Streetleaf - SL1 Test", groupId: 1890 }],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/populateLeadsunGateway$/);
    expect(init.headers.Authorization).toBe(`Bearer ${crew}`);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      LeadsunProjectId: "751", // ours, not the request's "999"
      GatewaySerialNumber: "AEXSAM2324070259",
      GroupName: "TESTSL1-1001 Streetleaf - SL1 Test", // "<gateway pole> <project name>"
    });
    expect(m.revalidateTag).toHaveBeenCalledWith("projects", { expire: 0 });
  });

  it("looks the gateway poles up for that project only", async () => {
    await post(good);
    expect(m.getPolesPage).toHaveBeenCalledWith(expect.objectContaining({ projectId: "p1", pageSize: 1000 }), crew);
  });

  it.each([
    ["the project isn't set up yet", { ...good, projectId: "p-new" }, 409, "Set up this project first."],
    ["the pole isn't a gateway pole", { ...good, poleNumber: "TESTSL1-1002" }, 422, "TESTSL1-1002 isn't a gateway pole in this project."],
    ["the pole is another project's gateway", { ...good, poleNumber: "OTHER-1" }, 422, "OTHER-1 isn't a gateway pole in this project."],
    ["the gateway pole already has a gateway", { ...good, projectId: "p-done" }, 409, "A gateway is already registered for TESTSL1-1001."],
    ["there's no serial", { ...good, gatewaySerial: "  " }, 400, "Gateway Serial Number is required."],
    ["the serial is too long", { ...good, gatewaySerial: "X".repeat(65) }, 400, "That gateway serial number is too long."],
    ["there's no pole", { ...good, poleNumber: "" }, 400, "A project and gateway pole are required."],
  ])("refuses when %s, without calling APIM", async (_why, body, status, error) => {
    const res = await post(body);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("404s a project that isn't on the Install screen", async () => {
    expect((await post({ ...good, projectId: "nope" })).status).toBe(404);
  });

  it("is only for the roles with the Install tab", async () => {
    const owner = testToken({ sub: "o", role: "Customer Owner", customerId: "c1", exp });
    expect((await post(good, owner)).status).toBe(403);
    expect((await post(good, null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes APIM's refusal back with its reason, clearing nothing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Gateway serial not found" }), { status: 400 }));
    const res = await post(good);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Gateway serial not found");
    expect(m.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("GET /api/mobile/install-setup/gateway-poles", () => {
  const get = (qs: string, token: string | null = crew) =>
    GATEWAY_POLES(new NextRequest(`http://localhost/api/mobile/install-setup/gateway-poles${qs}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));

  it("lists the project's gateway poles, and which already have a gateway", async () => {
    expect(await (await get("?projectId=p1")).json()).toEqual({ poles: [{ poleNumber: "TESTSL1-1001", registered: false }] });
    expect(await (await get("?projectId=p-done")).json()).toEqual({ poles: [{ poleNumber: "TESTSL1-1001", registered: true }] });
  });

  it("needs a project on the Install screen, and the Install tab's roles", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?projectId=nope")).status).toBe(404);
    const owner = testToken({ sub: "o", role: "Customer Owner", customerId: "c1", exp });
    expect((await get("?projectId=p1", owner)).status).toBe(403);
  });
});
