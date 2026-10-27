import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { allProjects, customers } = vi.hoisted(() => ({ allProjects: vi.fn(), customers: vi.fn() }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getAllProjects: allProjects, getCustomers: customers };
});

import { GET } from "@/app/api/mobile/install-options/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const call = (role: string | null, customerId?: string) =>
  GET(
    new NextRequest("http://localhost/api/mobile/install-options", {
      headers: role ? { authorization: `Bearer ${testToken({ sub: "u", role, exp, ...(customerId ? { customerId } : {}) })}` } : {},
    }),
  );

const project = (id: string, name: string, customerId: string, stickers: string[], active = true) => ({
  id,
  name,
  customerId,
  stickerNumbers: stickers,
  active,
  leadsunProject: null,
});

beforeEach(() => {
  allProjects.mockResolvedValue([
    project("p1", "Spine Road", "c2", ["CHA-1157", "CHA-1158"]),
    project("p2", "No stickers", "c1", []),
    project("p3", "Old job", "c1", ["OLD-1"], false),
    project("p4", "Alpha Street", "c1", ["BAB-1"]),
  ]);
  customers.mockResolvedValue([
    { id: "c1", name: "Babcock Ranch " },
    { id: "c2", name: "Coastal" },
  ]);
});
afterEach(() => [allProjects, customers].forEach((f) => f.mockReset()));

describe("GET /api/mobile/install-options", () => {
  it("lists active projects with stickers, by customer then project, for crew", async () => {
    const res = await call("Streetleaf Crew");
    expect(res.status).toBe(200);
    const body = await res.json();
    const noSetup = { leadsunProject: false, gateways: [] };
    expect(body.projects).toEqual([
      { id: "p4", name: "Alpha Street", customerName: "Babcock Ranch", stickerNumbers: ["BAB-1"], setup: noSetup },
      { id: "p1", name: "Spine Road", customerName: "Coastal", stickerNumbers: ["CHA-1157", "CHA-1158"], setup: noSetup },
    ]);
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
  });

  it("includes each project's setup: its Leadsun project and gateways", async () => {
    allProjects.mockResolvedValue([
      {
        ...project("p1", "Spine Road", "c2", ["CHA-1157"]),
        leadsunProject: {
          ProjectId: "LS-1",
          ProjectName: "Spine Road",
          totalGateways: 1,
          totalPoles: 0,
          groups: [{ GroupId: 1, GroupName: "North", GatewayCode: "GW-0042", totalPoles: 0, products: [] }],
        },
      },
    ]);
    const body = await (await call("Streetleaf Crew")).json();
    expect(body.projects[0].setup).toEqual({ leadsunProject: true, gateways: [{ code: "GW-0042", name: "North" }] });
  });

  it("is available to Streetleaf Admins too (they have the Install tab)", async () => {
    expect((await call("Streetleaf Admin")).status).toBe(200);
  });

  it.each([["Customer Admin", "c1"], ["User", "c1"], ["Customer Owner", "c1"]])("403s %s", async (role, customerId) => {
    expect((await call(role, customerId)).status).toBe(403);
    expect(allProjects).not.toHaveBeenCalled();
  });

  it("401s without a session", async () => {
    expect((await call(null)).status).toBe(401);
  });
});
