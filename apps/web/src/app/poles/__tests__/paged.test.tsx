import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

/** Which poles source each viewer uses: APIM's paged /getPoles, or the full list (crew). */
const m = vi.hoisted(() => ({
  getPolesPage: vi.fn(),
  getPoles: vi.fn(),
  getAllProjects: vi.fn(),
  sessionUser: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getPolesPage: m.getPolesPage, getPoles: m.getPoles, getAllProjects: m.getAllProjects };
});
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getSessionUser: m.sessionUser,
  getSessionToken: m.token,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/poles",
}));

import PolesPage from "@/app/poles/page";
import { GET as MOBILE_POLES } from "@/app/api/mobile/poles/route";
import { clearPolesCache } from "@/lib/mobile-poles";
import { pagePolesFromApi } from "@/lib/pagePoles";

const exp = Math.floor(Date.now() / 1000) + 3600;
const pole = (n: string, customerId = "c1") => ({
  id: `id-${n}`,
  poleNumber: n,
  customerId,
  projectId: "p1",
  isOnline: true,
  connectedText: "Online",
  overallStatusText: "OK",
  lightStatusText: "ON",
  panelStatusText: "Charging",
  panelIdleReason: null,
  batteryStatusText: "OK",
});
const pageOf = (total: number, items: ReturnType<typeof pole>[], page = 1) => ({ total, page, pageSize: 10, items });

afterEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  clearPolesCache();
});

describe("dashboard Poles list", () => {
  const visit = async (user: { id: string; role: string; customerId: string | null }, search: Record<string, string> = {}) => {
    m.sessionUser.mockResolvedValue(user);
    m.token.mockResolvedValue(testToken({ sub: user.id, role: user.role, exp, ...(user.customerId ? { customerId: user.customerId } : {}) }));
    render(await PolesPage({ searchParams: Promise.resolve(search) }));
  };

  it("staff: asks APIM for just this page (searched there), never the full list", async () => {
    m.getPolesPage.mockResolvedValue(pageOf(13950, [pole("PAS-0011")], 2));
    await visit({ id: "sa", role: "Streetleaf Admin", customerId: null }, { page: "2", pole_q: "PAS" });
    expect(m.getPolesPage).toHaveBeenCalledWith({ page: 2, pageSize: 10, poleNumber: "PAS", customerId: undefined }, expect.any(String));
    expect(m.getPoles).not.toHaveBeenCalled();
    expect(screen.getByText("13950 poles")).toBeInTheDocument();
    expect(screen.getByText("PAS-0011")).toBeInTheDocument();
  });

  it("customer users: the page is limited to their customer, and checked again", async () => {
    m.getPolesPage.mockResolvedValue(pageOf(2, [pole("PAS-1", "c1"), pole("OTHER-1", "c9")]));
    await visit({ id: "ca", role: "Customer Admin", customerId: "c1" });
    expect(m.getPolesPage).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1" }), expect.any(String));
    expect(screen.getByText("PAS-1")).toBeInTheDocument();
    expect(screen.queryByText("OTHER-1")).not.toBeInTheDocument();
  });

  it("crew: still the full list, filtered to their sticker projects", async () => {
    m.getAllProjects.mockResolvedValue([{ id: "p1", customerId: "c1", active: true, stickerNumbers: ["S-1"] }]);
    m.getPoles.mockResolvedValue([pole("PAS-1"), { ...pole("PAS-2"), projectId: "p-other" }]);
    await visit({ id: "cr", role: "Streetleaf Crew", customerId: null });
    expect(m.getPolesPage).not.toHaveBeenCalled();
    expect(screen.getByText("PAS-1")).toBeInTheDocument();
    expect(screen.queryByText("PAS-2")).not.toBeInTheDocument();
  });
});

describe("app Poles tab (/api/mobile/poles)", () => {
  const call = (token: string, qs = "") =>
    MOBILE_POLES(new NextRequest(`http://localhost/api/mobile/poles${qs}`, { headers: { authorization: `Bearer ${token}` } }));

  it("staff: one page from APIM, with the app's counts", async () => {
    m.getPolesPage.mockResolvedValue(pageOf(23, Array.from({ length: 10 }, (_, i) => pole(`PAS-${i + 11}`)), 2));
    const body = await (await call(testToken({ sub: "sa", role: "Streetleaf Admin", exp }), "?page=2&q=PAS")).json();
    expect(m.getPolesPage).toHaveBeenCalledWith({ page: 2, pageSize: 10, poleNumber: "PAS", customerId: undefined }, expect.any(String));
    expect(m.getPoles).not.toHaveBeenCalled();
    expect(body).toMatchObject({ page: 2, totalPages: 3, totalItems: 23, firstItem: 11, lastItem: 20 });
    expect(body.rows).toHaveLength(10);
  });

  it("customer users: limited to their customer, without 48h Connected", async () => {
    m.getPolesPage.mockResolvedValue(pageOf(1, [pole("PAS-1", "c1")]));
    const body = await (await call(testToken({ sub: "ca", role: "Customer Admin", customerId: "c1", exp }))).json();
    expect(m.getPolesPage).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1" }), expect.any(String));
    expect(body.rows[0]).not.toHaveProperty("connectedText");
  });

  it("crew: still the full list", async () => {
    m.getAllProjects.mockResolvedValue([{ id: "p1", customerId: "c1", active: true, stickerNumbers: ["S-1"] }]);
    m.getPoles.mockResolvedValue([pole("PAS-1")]);
    const body = await (await call(testToken({ sub: "cr", role: "Streetleaf Crew", exp }))).json();
    expect(m.getPolesPage).not.toHaveBeenCalled();
    expect(body.rows.map((r: { poleNumber: string }) => r.poleNumber)).toEqual(["PAS-1"]);
  });
});

describe("pagePolesFromApi", () => {
  it("shows the last page for a page past the end (e.g. an old link)", async () => {
    m.getPolesPage
      .mockResolvedValueOnce(pageOf(23, [], 9)) // nothing on page 9
      .mockResolvedValueOnce(pageOf(23, [pole("PAS-21"), pole("PAS-22"), pole("PAS-23")], 3));
    const shown = await pagePolesFromApi({ page: "9" }, "t");
    expect(m.getPolesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }), "t");
    expect([shown.page, shown.totalPages, shown.rows.length]).toEqual([3, 3, 3]);
  });

  it("says 'no matches' (not 'no poles on file') for a search with no results", async () => {
    m.getPolesPage.mockResolvedValue(pageOf(0, []));
    expect((await pagePolesFromApi({ page: "1", poleNumber: "zzz" }, "t")).unfilteredTotal).toBeGreaterThan(0);
    expect((await pagePolesFromApi({ page: "1" }, "t")).unfilteredTotal).toBe(0);
  });
});
