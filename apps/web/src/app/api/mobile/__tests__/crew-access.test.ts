import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const m = vi.hoisted(() => ({
  getAllProjects: vi.fn(),
  getCustomers: vi.fn(),
  getCustomer: vi.fn(),
  getProjectsForCustomer: vi.fn(),
  getPoleVitalsForCustomer: vi.fn(),
  getPoles: vi.fn(),
  getPoleVitalsByPeriod: vi.fn(),
}));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, ...m };
});
vi.mock("@/lib/leadsunClient", () => ({ fetchLeadsunLampStatus: vi.fn(async () => []) }));

import { clearPolesCache } from "@/lib/mobile-poles";
import { GET as LIST_CUSTOMERS } from "@/app/api/mobile/customers/route";
import { GET as CUSTOMER } from "@/app/api/mobile/customers/[customerId]/route";
import { GET as PROJECT } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/route";
import { GET as POLE } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/route";
import { GET as VITALS } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/vitals/route";
import { GET as PROJECT_REMOTE } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/remote/route";
import { GET as POLE_REMOTE } from "@/app/api/mobile/customers/[customerId]/projects/[projectId]/poles/[poleId]/remote/route";
import { GET as POLES } from "@/app/api/mobile/poles/route";
import { GET as LOOKUP } from "@/app/api/mobile/pole/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const crew = testToken({ sub: "crew1", role: "Streetleaf Crew", exp });
const staff = testToken({ sub: "sa1", role: "Streetleaf Admin", exp });

// c1: p1 has stickers, p2 doesn't. c2: no sticker projects. c3: p4 has stickers.
const project = (id: string, customerId: string, stickers: string[], active = true) => ({
  id,
  name: `Project ${id}`,
  customerId,
  stickerNumbers: stickers,
  leadsunProject: null,
  active,
});
const allProjects = [
  project("p1", "c1", ["CHA-1157", "CHA-1158"]),
  project("p2", "c1", []),
  project("p3", "c2", []),
  project("p4", "c3", ["BAB-1"]),
  project("p5", "c1", ["OLD-1"], false), // inactive: hidden from crew even with stickers
];
const vitalsFor = (id: string, lights: number, faults: number, pct: number) => ({
  id,
  name: `Project ${id}`,
  totalLights: lights,
  connectedLights: lights,
  totalFaults: faults,
  percentWorking: pct,
  poles: [{ id: `pole-${id}`, poleNumber: `PAS-${id}`, locationId: `LOC-${id}`, poleIssues: [] }],
});
const recent = new Date(Date.now() - 3600_000).toISOString().replace("T", " ").replace("Z", "+00:00");
const pole = (n: string, projectId: string, customerId: string) => ({
  id: `pole-${projectId}`,
  poleNumber: n,
  customerId,
  projectId,
  isOnline: true,
  connectedText: "Online",
  overallStatusText: "OK",
  lightStatusText: "ON",
  panelStatusText: "Charging",
  panelIdleReason: null,
  batteryStatusText: "OK",
  isPoleFault: true,
  lastUpdate: recent,
});

beforeEach(() => {
  clearPolesCache();
  m.getAllProjects.mockResolvedValue(allProjects);
  m.getCustomers.mockResolvedValue([
    { id: "c1", name: "Coastal", projects: [] },
    { id: "c2", name: "Harbor", projects: [] },
    { id: "c3", name: "Babcock", projects: [] },
  ]);
  m.getCustomer.mockImplementation(async (id: string) => ({ id, name: `Customer ${id}`, projects: [], active: true }));
  m.getProjectsForCustomer.mockImplementation(async (id: string) => allProjects.filter((p) => p.customerId === id));
  m.getPoleVitalsForCustomer.mockResolvedValue({
    totalLights: 30,
    connectedLights: 30,
    totalFaults: 5,
    percentWorking: 90,
    projects: [vitalsFor("p1", 10, 1, 90), vitalsFor("p2", 20, 4, 80)],
  });
  m.getPoles.mockResolvedValue([pole("PAS-p1", "p1", "c1"), pole("PAS-p2", "p2", "c1"), pole("PAS-p4", "p4", "c3")]);
  m.getPoleVitalsByPeriod.mockResolvedValue({ vitals: [] });
});
afterEach(() => Object.values(m).forEach((fn) => fn.mockReset()));

const req = (t: string, path: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${t}` } });
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

describe("Streetleaf Crew see only projects with sticker numbers", () => {
  it("lists only customers with a sticker project", async () => {
    const body = await (await LIST_CUSTOMERS(req(crew, "/api/mobile/customers"))).json();
    expect(body.customers.map((c: { id: string }) => c.id)).toEqual(["c3", "c1"]); // Babcock, Coastal (by name)
    const all = await (await LIST_CUSTOMERS(req(staff, "/api/mobile/customers"))).json();
    expect(all.customers).toHaveLength(3); // staff unchanged
  });

  it("shows a customer's sticker projects only, with totals over just those", async () => {
    const body = await (await CUSTOMER(req(crew, "/api/mobile/customers/c1"), params({ customerId: "c1" }))).json();
    expect(body.projects.map((p: { id: string }) => p.id)).toEqual(["p1"]);
    expect(body.summary).toEqual({ totalLights: 10, connectedLights: 10, totalFaults: 1, percentWorking: 90 });

    const staffBody = await (await CUSTOMER(req(staff, "/api/mobile/customers/c1"), params({ customerId: "c1" }))).json();
    expect(staffBody.projects.map((p: { id: string }) => p.id)).toEqual(["p1", "p2", "p5"]); // staff: every project, as before
    expect(staffBody.summary.totalLights).toBe(30); // whole customer, as before
  });

  it("hides inactive projects even when they have stickers", async () => {
    const body = await (await CUSTOMER(req(crew, "/api/mobile/customers/c1"), params({ customerId: "c1" }))).json();
    expect(body.projects.map((p: { id: string }) => p.id)).not.toContain("p5");
    expect((await PROJECT(req(crew, "/x"), params({ customerId: "c1", projectId: "p5" }))).status).toBe(404);
  });

  it("404s a customer without sticker projects", async () => {
    expect((await CUSTOMER(req(crew, "/api/mobile/customers/c2"), params({ customerId: "c2" }))).status).toBe(404);
  });

  it("404s every route for a project without sticker numbers", async () => {
    const p2 = { customerId: "c1", projectId: "p2" };
    const p2pole = { ...p2, poleId: "pole-p2" };
    expect((await PROJECT(req(crew, "/x"), params(p2))).status).toBe(404);
    expect((await POLE(req(crew, "/x"), params(p2pole))).status).toBe(404);
    expect((await VITALS(req(crew, "/x?days=2"), params(p2pole))).status).toBe(404);
    expect((await PROJECT_REMOTE(req(crew, "/x"), params(p2))).status).toBe(404);
    expect((await POLE_REMOTE(req(crew, "/x"), params(p2pole))).status).toBe(404);
  });

  it("allows those routes for a sticker project", async () => {
    const p1 = { customerId: "c1", projectId: "p1" };
    expect((await PROJECT(req(crew, "/x"), params(p1))).status).toBe(200);
    expect((await POLE(req(crew, "/x"), params({ ...p1, poleId: "pole-p1" }))).status).toBe(200);
    expect((await VITALS(req(crew, "/x?days=2"), params({ ...p1, poleId: "pole-p1" }))).status).toBe(200);
  });

  it("shows only sticker-project poles in the Poles list, and no faults for other customers", async () => {
    const body = await (await POLES(req(crew, "/api/mobile/poles"))).json();
    expect(body.rows.map((r: { poleNumber: string }) => r.poleNumber)).toEqual(["PAS-p1", "PAS-p4"]);
    const faults = await (await POLES(req(crew, "/api/mobile/poles?faults=1&customerId=c1"))).json();
    expect(faults.rows.map((r: { poleNumber: string }) => r.poleNumber)).toEqual(["PAS-p1"]);
    expect((await POLES(req(crew, "/api/mobile/poles?faults=1&customerId=c2"))).status).toBe(404);
    expect((await POLES(req(crew, "/api/mobile/poles?faults=1&customerId=c1&projectId=p2"))).status).toBe(404);
  });

  it("doesn't find a pole by number outside their projects", async () => {
    m.getPoles.mockResolvedValue([
      { ...pole("PAS-2001", "p2", "c1") },
      { ...pole("PAS-1001", "p1", "c1") },
    ]);
    expect((await (await LOOKUP(req(crew, "/api/mobile/pole?poleNumber=PAS-2001"))).json()).pole).toBeNull();
    expect((await (await LOOKUP(req(crew, "/api/mobile/pole?poleNumber=PAS-1001"))).json()).pole).not.toBeNull();
  });

  it("doesn't fetch every project for other roles", async () => {
    await LIST_CUSTOMERS(req(staff, "/api/mobile/customers"));
    await CUSTOMER(req(staff, "/api/mobile/customers/c1"), params({ customerId: "c1" }));
    expect(m.getAllProjects).not.toHaveBeenCalled();
  });
});
