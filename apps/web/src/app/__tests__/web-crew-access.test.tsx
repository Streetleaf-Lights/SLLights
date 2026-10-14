import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The web dashboard's Streetleaf Crew rule: only active projects with
 * sticker numbers, and the customers that have them — on the Customers,
 * customer, project, pole and Poles pages. Staff behaviour is unchanged.
 */
const m = vi.hoisted(() => ({
  getAllProjects: vi.fn(),
  getCustomers: vi.fn(),
  getCustomer: vi.fn(),
  getProjectsForCustomer: vi.fn(),
  getPoleVitalsForCustomer: vi.fn(),
  getPoles: vi.fn(),
  sessionUser: vi.fn(),
  captured: {} as Record<string, unknown>,
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    getAllProjects: m.getAllProjects,
    getCustomers: m.getCustomers,
    getCustomer: m.getCustomer,
    getProjectsForCustomer: m.getProjectsForCustomer,
    getPoleVitalsForCustomer: m.getPoleVitalsForCustomer,
    getPoles: m.getPoles,
  };
});
vi.mock("@/lib/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/session")>()),
  getSessionToken: vi.fn().mockResolvedValue("jwt"),
  getSessionUser: m.sessionUser,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
}));
// Capture what each page hands its main component, instead of rendering it.
vi.mock("@/components/CustomersTable", () => ({
  CustomersTable: (props: Record<string, unknown>) => ((m.captured.CustomersTable = props), <div>customers-table</div>),
}));
vi.mock("@/components/CustomerOverview", () => ({
  CustomerOverview: (props: Record<string, unknown>) => ((m.captured.CustomerOverview = props), <div>customer-overview</div>),
}));
vi.mock("@/components/PolesTable", () => ({
  PolesTable: (props: Record<string, unknown>) => ((m.captured.PolesTable = props), <div>poles-table</div>),
}));
vi.mock("@/components/DebugLog", () => ({ DebugLog: () => null }));
// Heavy pole-page parts that load external services (as in pole-detail-page.test.tsx).
vi.mock("@googlemaps/js-api-loader", () => ({ setOptions: vi.fn(), importLibrary: vi.fn(() => new Promise(() => {})) }));
vi.mock("@/components/PoleVitalsChart", () => ({ PoleVitalsChart: () => <div>vitals-chart</div> }));

import CustomersPage from "@/app/customers/page";
import CustomerDetailPage from "@/app/customers/[id]/page";
import ProjectDetailPage from "@/app/customers/[id]/projects/[projectId]/page";
import PoleDetailPage from "@/app/customers/[id]/projects/[projectId]/poles/[poleId]/page";
import PolesPage from "@/app/poles/page";

const crew = { id: "crew1", role: "Streetleaf Crew", customerId: null };
const staff = { id: "sa1", role: "Streetleaf Admin", customerId: null };

const project = (id: string, customerId: string, stickers: string[], active = true) => ({
  id,
  name: `Project ${id}`,
  customerId,
  stickerNumbers: stickers,
  leadsunProject: null,
  active,
});
const projects = [
  project("p1", "c1", ["CHA-1157"]),
  project("p2", "c1", []),
  project("p3", "c2", []),
  project("p4", "c3", ["BAB-1"]),
  project("p5", "c1", ["OLD-1"], false),
];
const customer = (id: string, name: string, projectIds: string[]) => ({
  id,
  name,
  projects: projectIds.map((pid) => ({ id: pid, name: `Project ${pid}` })),
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  active: true,
});
const pv = (id: string, lights: number, faults: number, pct: number) => ({
  id,
  name: `Project ${id}`,
  totalLights: lights,
  connectedLights: lights,
  totalFaults: faults,
  percentWorking: pct,
  poles: [],
});
const recent = new Date(Date.now() - 3600_000).toISOString().replace("T", " ").replace("Z", "+00:00");
const pole = (n: string, projectId: string, customerId: string) => ({
  id: `pole-${n}`,
  poleNumber: n,
  customerId,
  projectId,
  isPoleFault: true,
  lastUpdate: recent,
});

beforeEach(() => {
  m.captured = {};
  m.getAllProjects.mockResolvedValue(projects);
  m.getCustomers.mockResolvedValue([
    customer("c1", "Coastal", ["p1", "p2", "p5"]),
    customer("c2", "Harbor", ["p3"]),
    customer("c3", "Babcock", ["p4"]),
  ]);
  m.getCustomer.mockImplementation(async (id: string) => customer(id, `Customer ${id}`, []));
  m.getProjectsForCustomer.mockImplementation(async (id: string) => projects.filter((p) => p.customerId === id));
  m.getPoleVitalsForCustomer.mockResolvedValue({
    ...pv("c1", 35, 6, 85),
    projects: [pv("p1", 10, 1, 90), pv("p2", 20, 4, 80), pv("p5", 5, 1, 80)],
  });
  m.getPoles.mockResolvedValue([pole("PAS-1", "p1", "c1"), pole("PAS-2", "p2", "c1"), pole("PAS-4", "p4", "c3")]);
});
afterEach(() => vi.clearAllMocks());

const params = <T,>(p: T) => Promise.resolve(p);

describe("web dashboard: Streetleaf Crew", () => {
  it("Customers page lists only customers with active sticker projects, and only those projects", async () => {
    m.sessionUser.mockResolvedValue(crew);
    render(await CustomersPage());
    const customers = m.captured.CustomersTable as { customers: { id: string; projects: { id: string }[] }[] };
    expect(customers.customers.map((c) => [c.id, c.projects.map((p) => p.id)])).toEqual([
      ["c1", ["p1"]],
      ["c3", ["p4"]],
    ]);
  });

  it("Customers page is unchanged for staff (and doesn't fetch every project)", async () => {
    m.sessionUser.mockResolvedValue(staff);
    render(await CustomersPage());
    expect((m.captured.CustomersTable as { customers: unknown[] }).customers).toHaveLength(3);
    expect(m.getAllProjects).not.toHaveBeenCalled();
  });

  it("customer page shows only the crew's projects, with totals over those", async () => {
    m.sessionUser.mockResolvedValue(crew);
    render(await CustomerDetailPage({ params: params({ id: "c1" }), searchParams: params({}) }));
    const props = m.captured.CustomerOverview as { projects: { id: string }[]; vitals: { totalLights: number; totalFaults: number; projects: { id: string }[] } };
    expect(props.projects.map((p) => p.id)).toEqual(["p1"]);
    expect(props.vitals.projects.map((p) => p.id)).toEqual(["p1"]);
    expect([props.vitals.totalLights, props.vitals.totalFaults]).toEqual([10, 1]);
  });

  it("customer page is 'not found' for a customer without active sticker projects", async () => {
    m.sessionUser.mockResolvedValue(crew);
    render(await CustomerDetailPage({ params: params({ id: "c2" }), searchParams: params({}) }));
    expect(screen.getByText("Customer not found")).toBeTruthy();
    expect(m.captured.CustomerOverview).toBeUndefined();
  });

  it("project page is 'not found' for a project without stickers, or an inactive one", async () => {
    m.sessionUser.mockResolvedValue(crew);
    for (const projectId of ["p2", "p5"]) {
      const { unmount } = render(await ProjectDetailPage({ params: params({ id: "c1", projectId }), searchParams: params({}) }));
      expect(screen.getByText(/not found/i)).toBeTruthy();
      unmount();
    }
  });

  it("pole page is 'not found' for a real pole in a project without stickers, but shown to staff", async () => {
    // A complete pole that genuinely exists in p2 — only the crew rule can hide it.
    const realPole = {
      id: "pole-p2",
      poleNumber: "PAS-2001",
      locationId: "loc-2",
      active: true,
      isOnline: true,
      installDate: "2025-08-28",
      lat: 28.3,
      long: -82.27,
      lastUpdate: recent,
      batteryVoltage1: 13.5,
      batteryVoltage2: 13.7,
      lampPower1: 45,
      lampPower2: 46,
      batteryElecCurrent1: 90,
      batteryElecCurrent2: 100,
      solarBoardVoltage: 18.5,
      solarBoardElecCurrent: 4.4,
      avgBatteryPercentage: 90,
      avgPanelPercentage: 10,
      avgLightPercentage: 11,
      sunsetTime: null,
      lightStatusText: "OK",
      panelStatusText: "OK",
      panelIdleReason: "OK",
      batteryStatusText: "OK",
      electricCurrentAverage: 0,
      connectedText: "Online",
      overallStatusText: "OK",
      isLedFault: false,
      isBatteryFault: false,
      isPanelFault: false,
      isOpenIssueFault: false,
      isPoleFault: false,
      poleIssues: [],
    };
    m.getPoleVitalsForCustomer.mockResolvedValue({
      ...pv("c1", 20, 0, 100),
      projects: [{ ...pv("p2", 20, 0, 100), poles: [realPole] }],
    });
    const pageFor = async () =>
      render(await PoleDetailPage({ params: params({ id: "c1", projectId: "p2", poleId: "pole-p2" }), searchParams: params({}) }));

    m.sessionUser.mockResolvedValue(staff);
    const { unmount } = await pageFor();
    expect(screen.getAllByText("PAS-2001").length).toBeGreaterThan(0); // the pole page exists
    unmount();

    m.sessionUser.mockResolvedValue(crew);
    await pageFor();
    expect(screen.getByText(/not found/i)).toBeTruthy();
    expect(screen.queryByText("PAS-2001")).toBeNull();
  });

  it("Poles page shows only poles in the crew's projects", async () => {
    m.sessionUser.mockResolvedValue(crew);
    render(await PolesPage({ searchParams: params({}) }));
    expect((m.captured.PolesTable as { poles: { poleNumber: string }[] }).poles.map((p) => p.poleNumber)).toEqual(["PAS-1", "PAS-4"]);
  });

  it("faults view only for the crew's customers and projects, and only their poles", async () => {
    m.sessionUser.mockResolvedValue(crew);
    render(await PolesPage({ searchParams: params({ customerId: "c1", faults: "1" }) }));
    expect((m.captured.PolesTable as { poles: { poleNumber: string }[] }).poles.map((p) => p.poleNumber)).toEqual(["PAS-1"]);

    // Another project of theirs-or-not: falls back to the normal (crew-filtered) list, never p2's poles.
    m.captured = {};
    render(await PolesPage({ searchParams: params({ customerId: "c1", projectId: "p2", faults: "1" }) }));
    const shown = (m.captured.PolesTable as { poles: { poleNumber: string }[]; projectNames?: unknown }).poles.map((p) => p.poleNumber);
    expect(shown).not.toContain("PAS-2");
  });
});
