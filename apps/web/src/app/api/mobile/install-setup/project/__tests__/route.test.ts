import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const m = vi.hoisted(() => ({ getAllProjects: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidateTag }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getAllProjects: m.getAllProjects };
});

import { POST, SETUP_REMARK } from "@/app/api/mobile/install-setup/project/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const crew = testToken({ sub: "crew1", role: "Streetleaf Crew", exp });
const project = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Project ${id}`,
  customerId: "c1",
  active: true,
  stickerNumbers: ["S-1"],
  leadsunProject: null,
  ...extra,
});
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ projectId: "p1", projectName: "Project p1", leadsunProject: { ProjectId: "748" } }), { status: 201 }),
  );
  m.getAllProjects.mockResolvedValue([
    project("p1"),
    project("p-done", { leadsunProject: { ProjectId: "700", ProjectName: "x", totalGateways: 0, totalPoles: 0, groups: [] } }),
    project("p-inactive", { active: false }),
    project("p-nostickers", { stickerNumbers: [] }),
  ]);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  m.getAllProjects.mockReset();
  m.revalidateTag.mockReset();
});

const post = (body: unknown, token: string | null = crew) =>
  POST(
    new NextRequest("http://localhost/api/mobile/install-setup/project", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/mobile/install-setup/project (Set up project)", () => {
  it("creates the project via populateLeadsunProject, named from our records, then clears cached project lists", async () => {
    const res = await post({ projectId: "p1", projectName: "Something the phone made up" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ projectId: "p1", leadsunProjectId: "748" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/populateLeadsunProject$/);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe(`Bearer ${crew}`);
    expect(JSON.parse(init.body)).toEqual({ ProjectId: "p1", ProjectName: "Project p1", remark: SETUP_REMARK });
    expect(m.revalidateTag).toHaveBeenCalledWith("projects", { expire: 0 });
  });

  it("sends no names or emails in the remark (it goes to a third party)", () => {
    expect(SETUP_REMARK).not.toMatch(/@|crew1/);
  });

  it("refuses a project that's already set up — no duplicate on Leadsun", async () => {
    const res = await post({ projectId: "p-done" });
    expect(res.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["p-inactive"], ["p-nostickers"], ["unknown"]])("404s %s (not on the Install screen)", async (id) => {
    expect((await post({ projectId: id })).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is only for the roles with the Install tab", async () => {
    const owner = testToken({ sub: "o", role: "Customer Owner", customerId: "c1", exp });
    expect((await post({ projectId: "p1" }, owner)).status).toBe(403);
    expect((await post({ projectId: "p1" }, null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s a missing or malformed request", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
  });

  it("passes APIM's refusal back with its reason, clearing nothing", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "Project name already exists" }), { status: 400 }));
    const res = await post({ projectId: "p1" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Project name already exists");
    expect(m.revalidateTag).not.toHaveBeenCalled();
  });

  it("reports a success without the new id as an error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ projectId: "p1" }), { status: 201 }));
    expect((await post({ projectId: "p1" })).status).toBe(502);
  });
});
