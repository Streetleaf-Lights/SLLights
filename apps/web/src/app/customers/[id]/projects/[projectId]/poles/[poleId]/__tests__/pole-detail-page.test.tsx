import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Customer, CustomerPoleVitals, LeadsunProject, Project } from "@/lib/types";
import { formatTimestamp } from "@/lib/text";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

/**
 * A timestamp within the last 48h, formatted like the API's own
 * (space-separated, explicit offset). isSilentPole compares lastUpdate
 * against the real current time, so a hardcoded past date would drift
 * into "silent" territory (and start failing these "normal" tests) the
 * further away the actual test-run date gets from when it was written.
 */
function recentTimestamp(hoursAgo = 1): string {
  const iso = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  return iso.replace("T", " ").replace(/\.\d{3}Z$/, "+00:00");
}

const RECENT_LAST_UPDATE = recentTimestamp(1);
const RECENT_LAST_UPDATE_DISPLAY = formatTimestamp(RECENT_LAST_UPDATE);

const {
  getCustomerMock,
  getProjectsForCustomerMock,
  getPoleVitalsForCustomerMock,
  getSessionUserMock,
  getSessionTokenMock,
} = vi.hoisted(() => ({
  getCustomerMock: vi.fn(),
  getProjectsForCustomerMock: vi.fn(),
  getPoleVitalsForCustomerMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionTokenMock: vi.fn().mockResolvedValue("jwt-token"),
}));

vi.mock("@/lib/apim", () => ({
  getCustomer: getCustomerMock,
  getProjectsForCustomer: getProjectsForCustomerMock,
  getPoleVitalsForCustomer: getPoleVitalsForCustomerMock,
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getSessionUser: getSessionUserMock,
    getSessionToken: getSessionTokenMock,
  };
});

// LocationMap (used by PoleMap) loads the real Google Maps JS API otherwise —
// not appropriate for a page-level integration test, and the map's own
// internals are already covered by LocationMap.test.tsx.
vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(() => new Promise(() => {})),
}));

// PoleVitalsChart fetches from /api/getpolevitalsbyperiod on mount — not
// appropriate for this page-level test, and its internals get their own
// dedicated test file (PoleVitalsChart.test.tsx).
vi.mock("@/components/PoleVitalsChart", () => ({
  PoleVitalsChart: () => null,
}));

import PoleDetailPage from "@/app/customers/[id]/projects/[projectId]/poles/[poleId]/page";

const customer: Customer = {
  id: "r2",
  name: "Coastal Power & Light",
  projects: [{ id: "p1", name: "Bayou District Rebuild" }],
  address: null,
  city: "New Orleans",
  state: "LA",
  zip: null,
  phone: "504-555-0132",
  active: true,
};

const projects: Project[] = [
  {
    id: "p1",
    name: "Bayou District Rebuild",
    leadsunProject: null,
    active: true,
  },
];

const vitals: CustomerPoleVitals = {
  id: "r2",
  name: "Coastal Power & Light",
  totalLights: 1,
  connectedLights: 1,
  totalFaults: 0,
  percentWorking: 100,
  poles: [],
  projects: [
    {
      id: "p1",
      name: "Bayou District Rebuild",
      totalLights: 1,
      connectedLights: 1,
      totalFaults: 0,
      percentWorking: 100,
      poles: [
        {
          id: "pole1",
          poleNumber: "PAS-4938",
          locationId: "loc-1",
          active: true,
          isOnline: true,
          installDate: "2025-08-28",
          lat: 28.3031566,
          long: -82.2750467,
          lastUpdate: RECENT_LAST_UPDATE,
          batteryVoltage1: 13.509,
          batteryVoltage2: 13.785,
          lampPower1: 45,
          lampPower2: 46,
          batteryElecCurrent1: 90,
          batteryElecCurrent2: 100,
          solarBoardVoltage: 18.565,
          solarBoardElecCurrent: 4.443,
          avgBatteryPercentage: 90.43,
          avgPanelPercentage: 10.79,
          avgLightPercentage: 11.3,
          sunsetTime: null,
          lightStatusText: "OK",
          panelStatusText: "OK",
          panelIdleReason: "OK",
          batteryStatusText: "OK",
          electricCurrentAverage: 0, connectedText: "Online", overallStatusText: "OK",
          isLedFault: false,
          isBatteryFault: false,
          isPanelFault: false,
          isOpenIssueFault: false,
          isPoleFault: false, poleIssues: [],
        },
      ],
    },
  ],
};

describe("PoleDetailPage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", "test-map-id");
    getSessionUserMock.mockReset();
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  it("renders the pole number as the heading", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "PAS-4938" })).toBeInTheDocument();
  });

  it("does not show '(Inactive)' anywhere when both the project and pole are active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("shows '(Inactive)' next to the project name only, when the project is inactive but the pole is active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], active: false }]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const badges = screen.getAllByText("(Inactive)");
    expect(badges).toHaveLength(1);
    expect(badges[0].className).toContain("text-[var(--status-warning)]");
    const projectLine = badges[0].closest("p");
    expect(projectLine).toHaveTextContent("Bayou District Rebuild");
  });

  it("shows '(Inactive)' next to the pole number only, when the pole is inactive but the project is active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [{ ...vitals.projects[0].poles[0], active: false }],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const badges = screen.getAllByText("(Inactive)");
    expect(badges).toHaveLength(1);
    const poleHeading = screen.getByRole("heading", { name: /PAS-4938/ });
    expect(poleHeading).toContainElement(badges[0]);
  });

  it("shows '(Inactive)' next to both the project name and pole number when both are inactive", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], active: false }]);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [{ ...vitals.projects[0].poles[0], active: false }],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getAllByText("(Inactive)")).toHaveLength(2);
  });

  it("does not show '(Inactive)' when project.active or pole.active is undefined (regression: treating missing data as inactive caused false positives on first-ever loads)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], active: undefined }]);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [{ ...vitals.projects[0].poles[0], active: undefined }],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("shows the project name above the pole number", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const projectName = screen
      .getAllByText("Bayou District Rebuild")
      .find((el) => !el.closest("nav"));
    expect(projectName).toBeTruthy();
    expect(projectName?.className).toContain("text-[var(--accent)]");
  });

  it("renders the breadcrumb trail: Customers / Customer / Project", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const breadcrumb = within(screen.getByRole("navigation"));
    expect(breadcrumb.getByRole("link", { name: "\u2190 Customers" })).toHaveAttribute(
      "href",
      "/customers",
    );
    expect(breadcrumb.getByRole("link", { name: "Coastal Power & Light" })).toHaveAttribute(
      "href",
      "/customers/r2",
    );
    expect(breadcrumb.getByRole("link", { name: "Bayou District Rebuild" })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1",
    );
  });

  it("restores the search in the top-level Customers breadcrumb, and customer/project crumbs still carry it too", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({ cust_q: "coastal" }),
    });
    render(jsx);

    const breadcrumb = within(screen.getByRole("navigation"));
    expect(
      breadcrumb.getByRole("link", { name: "\u2190 Customer Search: \u201ccoastal\u201d" }),
    ).toHaveAttribute("href", "/customers?cust_q=coastal");
    expect(breadcrumb.getByRole("link", { name: "Coastal Power & Light" })).toHaveAttribute(
      "href",
      "/customers/r2?cust_q=coastal",
    );
    expect(breadcrumb.getByRole("link", { name: "Bayou District Rebuild" })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1?cust_q=coastal",
    );
  });

  it("shows the Poles breadcrumb (not Customers) when arriving via a pole search, restores it, and carries pole_q into customer/project crumbs", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({ pole_q: "12057" }),
    });
    render(jsx);

    const breadcrumb = within(screen.getByRole("navigation"));
    expect(
      breadcrumb.getByRole("link", { name: "\u2190 Pole Search: \u201c12057\u201d" }),
    ).toHaveAttribute("href", "/poles?pole_q=12057");
    expect(breadcrumb.queryByText(/Customer Search/)).not.toBeInTheDocument();
    expect(breadcrumb.getByRole("link", { name: "Coastal Power & Light" })).toHaveAttribute(
      "href",
      "/customers/r2?pole_q=12057",
    );
    expect(breadcrumb.getByRole("link", { name: "Bayou District Rebuild" })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1?pole_q=12057",
    );
  });

  it("shows Last Update, Install Date, Lat, Long, Connected, and Overall Status in the header", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText(RECENT_LAST_UPDATE_DISPLAY)).toBeInTheDocument(); // lastUpdate, tz stripped
    expect(screen.getByText("2025-08-28")).toBeInTheDocument(); // installDate
    expect(screen.getByText("28.3031566")).toBeInTheDocument(); // lat, full precision, not rounded
    expect(screen.getByText("-82.2750467")).toBeInTheDocument(); // long, full precision, not rounded
    expect(screen.queryByText("48h Connected:")).not.toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: OK",
    );
  });

  it("shows the header's Overall Status exactly as overallStatusText sends it — 'Not Reporting 48H', a value the old isPoleFault-based computation never produced — even when isPoleFault suggests otherwise", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isPoleFault: false, poleIssues: [],
              overallStatusText: "Not Reporting 48H",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: Not Reporting 48H",
    );
    const overallStatusValue = screen
      .getByText("48H Overall Status:")
      .parentElement?.querySelector("span:last-child");
    expect(overallStatusValue?.className).toContain("text-[var(--ink-muted)]");
    // Not bold — only OK/Fault get the bold treatment matching the cards.
    expect(overallStatusValue?.className).not.toContain("font-semibold");
    expect(overallStatusValue?.className).not.toContain("status-active");
    expect(overallStatusValue?.className).not.toContain("status-flagged");
  });

  it("shows Disconnected for 48h Connected when isOnline is null but the pole has reported before (lastUpdate present)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isOnline: null,
              lastUpdate: "2026-07-26 13:25:41+00:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const connectedText = screen.getByText("Disconnected");
    expect(connectedText.className).toContain("text-[var(--status-flagged)]");
  });

  it("shows Unknown for 48h Connected when isOnline is null and the pole has never reported (lastUpdate also null)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isOnline: null,
              lastUpdate: null,
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const connectedText = screen.getByText("Unknown");
    expect(connectedText.className).toContain("text-[var(--ink-faint)]");
  });

  it("does not crash and shows dashes when lat/long/battery voltage are undefined (not just null)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lat: undefined,
              long: undefined,
              batteryVoltage1: undefined,
              batteryVoltage2: undefined,
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Lat:").parentElement).toHaveTextContent("Lat: —");
    expect(screen.getByText("Long:").parentElement).toHaveTextContent("Long: —");
  });

  it("shows the Light/Panel/Battery cards' own metric values in dark-gray (--ink-muted), matching the header's Last Update/Install Date tone — not the bolder --ink used before", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // "Operating Status" appears 3 times (Light/Panel/Battery); check each
    // metric row's value (the label's next sibling).
    const operatingStatuses = screen.getAllByText("Operating Status");
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling?.className).toContain("text-[var(--ink-muted)]");
      expect(label.nextElementSibling?.className).not.toContain("text-[var(--ink)]");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling?.className).toContain(
      "text-[var(--ink-muted)]",
    );
  });

  it("shows a Statuses section with Light/Panel/Battery/Issue boxes, all OK/No Issue (green) with correct metrics when no faults are flagged", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Statuses")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Battery")).toBeInTheDocument();
    expect(screen.getByText("Issue Entry")).toBeInTheDocument();

    // The 3 green box status badges (Light/Panel/Battery) are each their
    // title's next sibling — scoping this way (rather than a plain text
    // match) since the header's own Overall Status span and the metric
    // values below happen to read "OK" too in this fixture.
    const okBadges = ["Light", "Panel", "Battery"].map(
      (title) => screen.getByText(title).nextElementSibling as HTMLElement,
    );
    expect(okBadges).toHaveLength(3);
    for (const stat of okBadges) {
      expect(stat).toHaveTextContent("OK");
      expect(stat.className).toContain("font-semibold");
      expect(stat.className).toContain("text-[var(--status-active)]");
    }
    const noIssue = screen.getByText("None");
    expect(noIssue.className).toContain("text-[var(--status-active)]");
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: OK",
    );
    // The header's own Overall Status is bold too now, for OK/Fault,
    // matching the cards' own badges above.
    const headerOverallStatus = screen
      .getByText("48H Overall Status:")
      .parentElement?.querySelector("span:last-child");
    expect(headerOverallStatus?.className).toContain("font-semibold");
    expect(headerOverallStatus?.className).toContain("text-[var(--status-active)]");

    const operatingStatuses = screen.getAllByText("Operating Status");
    expect(operatingStatuses).toHaveLength(3);
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling).toHaveTextContent("OK");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling).toHaveTextContent("0");
    expect(screen.queryByText("Electric Current")).not.toBeInTheDocument();

    // Battery Percentage sits just above Electric Current 1 & 2.
    const avgElecCurrentRow = screen.getByText("Battery Percentage").closest("div");
    const elecCurrent1Row = screen.getByText("Electric Current 1").closest("div");
    expect(avgElecCurrentRow?.nextElementSibling).toBe(elecCurrent1Row);
  });

  /** Renders the page with vitals.projects[0].poles[0] merged with the given overrides. */
  async function renderWithPoleOverrides(overrides: Record<string, unknown>) {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [{ ...vitals.projects[0].poles[0], ...overrides }],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);
  }

  it("treats a pole as provisioned (single-channel) when lampPower2 is null — hides Light Power 2 and drops the '1' suffix from Light Power", async () => {
    await renderWithPoleOverrides({ lampPower2: null });

    expect(screen.getByText("Light Power")).toBeInTheDocument();
    expect(screen.queryByText("Light Power 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Light Power 2")).not.toBeInTheDocument();
  });

  it("treats a pole as provisioned when batteryElecCurrent2 is null — hides all three '2' metrics and drops the '1' suffix from all three labels, even though lampPower2/batteryVoltage2 are still real values (provisioned is a single, unified state, not per-field)", async () => {
    await renderWithPoleOverrides({ batteryElecCurrent2: null });

    expect(screen.getByText("Electric Current")).toBeInTheDocument();
    expect(screen.queryByText("Electric Current 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Electric Current 2")).not.toBeInTheDocument();
    // Light Power and Battery Voltage are ALSO affected, even though their
    // own channel-2 fields are still real (non-null) values — any one of
    // the three fields being null means the whole pole is provisioned.
    expect(screen.getByText("Light Power")).toBeInTheDocument();
    expect(screen.queryByText("Light Power 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Light Power 2")).not.toBeInTheDocument();
    expect(screen.getByText("Battery Voltage")).toBeInTheDocument();
    expect(screen.queryByText("Battery Voltage 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Battery Voltage 2")).not.toBeInTheDocument();
  });

  it("treats a pole as provisioned when batteryVoltage2 is null — hides Battery Voltage 2 and drops the '1' suffix from Battery Voltage", async () => {
    await renderWithPoleOverrides({ batteryVoltage2: null });

    expect(screen.getByText("Battery Voltage")).toBeInTheDocument();
    expect(screen.queryByText("Battery Voltage 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Battery Voltage 2")).not.toBeInTheDocument();
  });

  it("still shows the real (non-null) values under the renamed labels for a provisioned pole — the values themselves aren't affected, just the labels/visibility", async () => {
    await renderWithPoleOverrides({
      lampPower1: 12,
      lampPower2: null,
      batteryElecCurrent1: 85,
      batteryElecCurrent2: null,
      batteryVoltage1: 13.2,
      batteryVoltage2: null,
    });

    expect(screen.getByText("Light Power").nextElementSibling).toHaveTextContent("12");
    expect(screen.getByText("Electric Current").nextElementSibling).toHaveTextContent("85");
    expect(screen.getByText("Battery Voltage").nextElementSibling).toHaveTextContent("13.2V");
  });

  it("shows all 6 channel-1/2 metrics with their '1'/'2' suffixes intact for a normal (non-provisioned) pole — none of the three fields are null", async () => {
    await renderWithPoleOverrides({
      lampPower2: 46,
      batteryElecCurrent2: 100,
      batteryVoltage2: 13.8,
    });

    for (const label of [
      "Light Power 1",
      "Light Power 2",
      "Electric Current 1",
      "Electric Current 2",
      "Battery Voltage 1",
      "Battery Voltage 2",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText("Light Power")).not.toBeInTheDocument();
    expect(screen.queryByText("Electric Current")).not.toBeInTheDocument();
    expect(screen.queryByText("Battery Voltage")).not.toBeInTheDocument();
  });

  it("always shows plain 'Statuses' and 'Vitals History' section titles, regardless of how long the pole has been silent — no more 'Last Known' prefix at any point", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [{ ...vitals.projects[0].poles[0], lastUpdate: recentTimestamp(72) }],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // Header — no prefix.
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: OK",
    );

    // Section titles — always plain now, even for a long-silent pole.
    expect(screen.getByText("Statuses")).toBeInTheDocument();
    expect(screen.queryByText("Last Known Statuses")).not.toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Battery")).toBeInTheDocument();
    expect(screen.getByText("Issue Entry")).toBeInTheDocument();
    expect(screen.getByText("Vitals History")).toBeInTheDocument();
    expect(screen.queryByText("Last Known Vital History")).not.toBeInTheDocument();

    // Box metric labels are plain too — no prefix at all, silent or not —
    // the underlying values are unaffected by silence.
    const operatingStatuses = screen.getAllByText("Operating Status");
    expect(operatingStatuses).toHaveLength(3);
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling).toHaveTextContent("OK");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling).toHaveTextContent("0");
    expect(screen.queryByText("Last Known Operating Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Operating Status")).not.toBeInTheDocument();
  });

  it("shows Fault (red) for a flagged component, and Yes (red) for the Issue Entry box", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isPoleFault: true, poleIssues: [],
              isLedFault: true,
              isPanelFault: true,
              isBatteryFault: true,
              isOpenIssueFault: true,
              overallStatusText: "Fault",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // "Overall Status: Fault" in the header, plus Light/Panel/Battery boxes -> 4 total.
    const faultStats = screen.getAllByText("Fault");
    expect(faultStats).toHaveLength(4);
    for (const stat of faultStats) {
      expect(stat.className).toContain("text-[var(--status-flagged)]");
    }
    const openIssue = screen.getByText("Yes");
    expect(openIssue.className).toContain("text-[var(--status-flagged)]");
  });

  it("shows 'Report Issue' under Issue Entry when the pole has no poleIssues", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View or Report Issue" })).not.toBeInTheDocument();
  });

  it("shows 'View or Report Issue' under Issue Entry, and lists the issues in the modal, when the pole has poleIssues", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              poleIssues: [
                {
                  issueId: "ISS-100",
                  status: "Open",
                  poleStatus: "Electrical Issue",
                  dateReported: "2026-09-01",
                  problemDetails: "Lamp flickering at night",
                },
              ],
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    const user = userEvent.setup();

    expect(screen.queryByRole("button", { name: "Report Issue" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View or Report Issue" }));

    expect(screen.getByText("ISS-100")).toBeInTheDocument();
    expect(screen.getByText("Lamp flickering at night")).toBeInTheDocument();
  });

  it("shows 'Report Issue' when poleIssues is missing from the API response entirely, rather than crashing", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    const poleWithoutPoleIssues = { ...vitals.projects[0].poles[0] } as Record<string, unknown>;
    delete poleWithoutPoleIssues.poleIssues;
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [{ ...vitals.projects[0], poles: [poleWithoutPoleIssues] }],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
  });

  it("reports a new issue end to end from the pole detail page, posting the real poleNumber", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Report Issue" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Report Issue" }));
    expect(within(dialog).getByText("PAS-4938")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Structural Issue" }));
    await user.type(screen.getByRole("textbox"), "Cracked base");
    await user.click(screen.getByRole("button", { name: "Submit Issue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/createpoleissue");
    expect(JSON.parse(init.body)).toEqual({
      poleNumber: "PAS-4938",
      status: "Structural Issue",
      problemDetails: "Cracked base",
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows Disconnected (not a dash) for 48h Connected when isOnline is null but lastUpdate is present, and dashes for the null fault flags", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isOnline: null,
              isPoleFault: null, poleIssues: [],
              isLedFault: null,
              isPanelFault: null,
              isBatteryFault: null,
              isOpenIssueFault: null,
              overallStatusText: null,
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: —",
    );

    // Light/Panel/Battery boxes' status + Issue box's status -> 4 dashes,
    // none of them colored.
    const boxHeadings = [
      screen.getByText("Light"),
      screen.getByText("Panel"),
      screen.getByText("Battery"),
      screen.getByText("Issue Entry"),
    ];
    for (const heading of boxHeadings) {
      const statusEl = heading.nextElementSibling;
      expect(statusEl).toHaveTextContent("—");
      expect(statusEl?.className).not.toContain("status-active");
      expect(statusEl?.className).not.toContain("status-flagged");
    }
  });

  it("places the Statuses section above Vitals History and Location", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const statusesHeading = screen.getByText("Statuses");
    const vitalsHeading = screen.getByText("Vitals History");
    expect(
      statusesHeading.compareDocumentPosition(vitalsHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a Location section with a map container when the pole has coordinates", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByRole("application", { name: "Map" })).toBeInTheDocument();
  });

  it("shows a Vitals History section", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Vitals History")).toBeInTheDocument();
  });

  it("places the Vitals History section above the Location section", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const vitalsHeading = screen.getByText("Vitals History");
    const locationHeading = screen.getByText("Location");
    expect(
      vitalsHeading.compareDocumentPosition(locationHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a no-location fallback instead of a map when the pole has no coordinates", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              id: "pole1",
              poleNumber: "PAS-4938",
              locationId: "loc-1",
              active: true,
              isOnline: null,
              installDate: null,
              lat: null,
              long: null,
              lastUpdate: null,
              batteryVoltage1: null,
              batteryVoltage2: null,
              lampPower1: null,
              lampPower2: null,
              batteryElecCurrent1: null,
              batteryElecCurrent2: null,
              solarBoardVoltage: null,
              solarBoardElecCurrent: null,
              avgBatteryPercentage: null,
              avgPanelPercentage: null,
              avgLightPercentage: null,
              sunsetTime: null,
              lightStatusText: null,
              panelStatusText: null,
              panelIdleReason: null,
              batteryStatusText: null,
              electricCurrentAverage: null, connectedText: null, overallStatusText: null,
              isLedFault: null,
              isBatteryFault: null,
              isPanelFault: null,
              isOpenIssueFault: null,
              isPoleFault: null, poleIssues: [],
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("No location on file for this pole.")).toBeInTheDocument();
    expect(screen.queryByRole("application", { name: "Map" })).not.toBeInTheDocument();
  });

  it("shows Unknown for 48h Connected (not a dash) when both isOnline and lastUpdate are null, and dashes elsewhere for a pole with no telemetry", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              id: "pole1",
              poleNumber: "PAS-4938",
              locationId: "loc-1",
              active: true,
              isOnline: null,
              installDate: null,
              lat: null,
              long: null,
              lastUpdate: null,
              batteryVoltage1: null,
              batteryVoltage2: null,
              lampPower1: null,
              lampPower2: null,
              batteryElecCurrent1: null,
              batteryElecCurrent2: null,
              solarBoardVoltage: null,
              solarBoardElecCurrent: null,
              avgBatteryPercentage: null,
              avgPanelPercentage: null,
              avgLightPercentage: null,
              sunsetTime: null,
              lightStatusText: null,
              panelStatusText: null,
              panelIdleReason: null,
              batteryStatusText: null,
              electricCurrentAverage: null, connectedText: null, overallStatusText: null,
              isLedFault: null,
              isBatteryFault: null,
              isPanelFault: null,
              isOpenIssueFault: null,
              isPoleFault: null, poleIssues: [],
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: —",
    );
    for (const heading of [
      screen.getByText("Light"),
      screen.getByText("Panel"),
      screen.getByText("Battery"),
      screen.getByText("Issue Entry"),
    ]) {
      expect(heading.nextElementSibling).toHaveTextContent("—");
    }
    const operatingStatuses = screen.getAllByText("Operating Status");
    expect(operatingStatuses).toHaveLength(3);
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling).toHaveTextContent("—");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling).toHaveTextContent("—");
  });

  it("shows a dash on Light/Panel/Battery cards and the 48H Average % metrics when 48h Connected is Unknown, even though every fault flag and percentage has a real (non-null) value — but Issue Entry still shows its real value, since it isn't derived telemetry — and a dash on the header's Overall Status too, since overallStatusText is null here", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              isOnline: null,
              lastUpdate: null,
              // Real, non-null fault/percentage data — the point of this
              // test is that the Light/Panel/Battery cards and 48H
              // Average % metrics are still overridden to a dash, since
              // Unknown connectivity means this data has no reliable
              // telemetry basis (that override logic is unrelated to the
              // header, and unchanged here). Issue Entry is deliberately
              // NOT overridden — isOpenIssueFault isn't derived from the
              // pole's own telemetry, so a real false here still means
              // "no open issue" regardless of connectivity.
              // avgLightPercentage/avgPanelPercentage/avgBatteryPercentage
              // are already real values on the base fixture
              // (11.3/10.8/90.4), left as-is here. The header itself no
              // longer has any such override — it just shows whatever
              // overallStatusText the API sends, so this is set to null
              // here to realistically match an unknown-connectivity pole
              // (the API presumably wouldn't send "OK" for a pole it's
              // never heard from).
              isLedFault: true,
              isPanelFault: false,
              isBatteryFault: true,
              isOpenIssueFault: false,
              isPoleFault: true, poleIssues: [],
              overallStatusText: null,
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Unknown")).toBeInTheDocument();

    // Header's Overall Status — dashed because overallStatusText is null
    // in this fixture, not because of any client-side override (the
    // header no longer computes from isPoleFault/isUnknownConnected).
    expect(screen.getByText("48H Overall Status:").parentElement).toHaveTextContent(
      "48H Overall Status: —",
    );

    for (const title of ["Light", "Panel", "Battery"]) {
      const badge = screen.getByText(title).nextElementSibling;
      expect(badge).toHaveTextContent("—");
      expect(badge?.className).not.toContain("status-active");
      expect(badge?.className).not.toContain("status-flagged");
    }

    // Issue Entry shows its real value ("None", green) despite Unknown
    // connectivity — not dashed out like the other 3 cards.
    const issueBadge = screen.getByText("Issue Entry").nextElementSibling;
    expect(issueBadge).toHaveTextContent("None");
    expect(issueBadge?.className).toContain("text-[var(--status-active)]");

    expect(screen.getByText("48H Average Light %").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("48H Average Panel %").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("48H Average Battery %").nextElementSibling).toHaveTextContent("—");
    // Confirms this isn't a coincidental dash — the real percentages/fault
    // text would otherwise show up as these exact strings.
    expect(screen.queryByText("Fault")).not.toBeInTheDocument();
    expect(screen.queryByText("11.3%")).not.toBeInTheDocument();
    expect(screen.queryByText("10.8%")).not.toBeInTheDocument();
    expect(screen.queryByText("90.4%")).not.toBeInTheDocument();
  });

  it("groups Last Update + Install Date in one column, Lat + Long in another, and Connected + Overall Status in a third", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const lastUpdateLine = screen.getByText("Last Update:").parentElement;
    const installDateLine = screen.getByText("Install Date:").parentElement;
    const latLine = screen.getByText("Lat:").parentElement;
    const longLine = screen.getByText("Long:").parentElement;
    // "Connected" text now sits inside a dot+text wrapper span, itself a
    // direct child of the outer right-aligned group — same level as the
    // Overall Status line span.
    const connectedWrapper = screen.getByText("Online").parentElement;
    const overallStatusLine = screen.getByText("48H Overall Status:").parentElement;

    // Last Update and Install Date share the same column (parent).
    expect(lastUpdateLine?.parentElement).toBe(installDateLine?.parentElement);
    // Lat and Long share a different column from Last Update/Install Date.
    expect(latLine?.parentElement).toBe(longLine?.parentElement);
    expect(latLine?.parentElement).not.toBe(lastUpdateLine?.parentElement);
    // Connected and Overall Status share a third group, separate from the other two.
    expect(connectedWrapper?.parentElement).toBe(overallStatusLine?.parentElement);
    expect(connectedWrapper?.parentElement).not.toBe(lastUpdateLine?.parentElement);
    expect(connectedWrapper?.parentElement).not.toBe(latLine?.parentElement);
  });

  describe("Remote Control (header)", () => {
    const leadsunProject: LeadsunProject = {
      ProjectId: "545",
      ProjectName: "Bayou District Rebuild",
      totalGateways: 1,
      totalPoles: 1,
      groups: [
        {
          GroupId: 1263,
          GroupName: "Group A",
          GatewayCode: "GT12L94A2310260A",
          totalPoles: 1,
          products: [
            {
              ProductId: 12548,
              ProductName: "loc-1",
              ProvidedProductId: "AEXSAP4323111877",
              PoleNumber: "AEXSAP4323111877-A",
            },
          ],
        },
      ],
    };

    it("does not show a Remote Control link when the project has no leadsunProject at all", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue(projects);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await PoleDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.queryByRole("button", { name: "Remote Control" })).not.toBeInTheDocument();
    });

    it("does not show a Remote Control link when no product's ProductName matches this pole's locationId", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([
        {
          ...projects[0],
          leadsunProject: {
            ...leadsunProject,
            groups: [{ ...leadsunProject.groups[0], products: [] }],
          },
        },
      ]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await PoleDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.queryByRole("button", { name: "Remote Control" })).not.toBeInTheDocument();
    });

    it("shows a Remote Control link when a product's ProductName matches this pole's locationId", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], leadsunProject }]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await PoleDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByRole("button", { name: "Remote Control" })).toBeInTheDocument();
    });

    it("opens the stub modal when clicked", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], leadsunProject }]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await PoleDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("places Remote Control to the right of the Connected/Overall Status group — that group is now 2nd from the right", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], leadsunProject }]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await PoleDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      const remoteControlButton = screen.getByRole("button", { name: "Remote Control" });
      const connectedGroup = screen.getByText("Online").closest(
        ".flex.flex-col.items-end",
      ) as HTMLElement;
      const headerRow = connectedGroup.parentElement;

      // Both live in the same header row, with Remote Control's wrapper as
      // the connected group's very next sibling (i.e. further right).
      expect(headerRow?.contains(remoteControlButton)).toBe(true);
      expect(connectedGroup.nextElementSibling?.contains(remoteControlButton)).toBe(true);
    });
  });

  it("hides the '48h Connected' label for a Customer Admin, showing a dot + plain Online/Offline text right-aligned, with no Overall Status at all", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Customer Admin", customerId: "r2" });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("48h Connected:")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Overall Status:")).not.toBeInTheDocument();
    const online = screen.getByText("Online");
    // The dot indicator sits right alongside the text.
    const dot = online.parentElement?.querySelector("span[aria-hidden]");
    expect(dot?.className).toContain("rounded-full");
    expect(dot?.className).toContain("bg-[var(--status-active)]");
    // The whole group (dot + text) is right-aligned via the outer wrapper.
    expect(online.parentElement?.parentElement?.className).toContain("ml-auto");
  });

  it("hides the same labels for a 'Customer User' (role User, with a customerId) too", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u2", role: "User", customerId: "r2" });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("48h Connected:")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Overall Status:")).not.toBeInTheDocument();
  });

  it("drops the '48h Connected' label for a Streetleaf Admin too (dot + plain text now, same as customer scope), but still shows the '48H Overall Status' label", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("48h Connected:")).not.toBeInTheDocument();
    const online = screen.getByText("Online");
    const dot = online.parentElement?.querySelector("span[aria-hidden]");
    expect(dot?.className).toContain("rounded-full");
    expect(screen.getByText("48H Overall Status:")).toBeInTheDocument();
  });

  it("shows only a single simplified metric per box (Operating Status, + Battery Percentage for Battery) for a Customer Admin, dropping the 48H Average/point-in-time metrics", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Customer Admin", customerId: "r2" });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // The new simplified metrics are present, using the pole's real values.
    const operatingStatuses = screen.getAllByText("Operating Status");
    expect(operatingStatuses).toHaveLength(3);
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling).toHaveTextContent("OK");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling).toHaveTextContent("0");
    // Customer scope never gets the Recent/Last Known prefix Streetleaf does.
    expect(screen.queryByText("Recent Operating Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Last Known Operating Status")).not.toBeInTheDocument();

    // The old 48h-average and point-in-time metrics are gone entirely.
    expect(screen.queryByText("48H Average Light %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Light Power 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Light Power 2")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Average Panel %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Panel Voltage")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Panel Electric Current")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Average Battery %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Electric Current 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Electric Current 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Battery Voltage 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Battery Voltage 2")).not.toBeInTheDocument();
  });

  it("appends the idle reason in parentheses in the Panel Status metric when panelStatusText is Idle, for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Customer Admin", customerId: "r2" });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              panelStatusText: "Idle",
              panelIdleReason: "Battery Full",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const panelBox = screen.getByText("Panel").closest(".flex-1") as HTMLElement;
    expect(within(panelBox).getByText("Operating Status").nextElementSibling).toHaveTextContent(
      "Idle (Battery Full)",
    );
  });

  it("shows 'Expected ON @ ...' directly below the Light card's Operating Status row when lightStatusText is OFF, with a DST-aware US timezone abbreviation (EDT here, since -04:00 in August)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: "2026-08-28 19:54:31.130526-04:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const expectedOn = screen.getByText("Expected ON @ 19:54 EDT");
    const lightBox = screen.getByText("Light").closest(".flex-1") as HTMLElement;
    const operatingStatusRow = within(lightBox).getByText("Operating Status").closest("div");
    // The note sits immediately after the Operating Status row, not at the
    // bottom of the whole card.
    expect(operatingStatusRow?.nextElementSibling).toBe(expectedOn);
  });

  it("positions 'Expected ON @ ...' right below Operating Status, above 48H Average Light % and Light Power 1/2, for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: "2026-08-28 19:54:31.130526-04:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const lightBox = screen.getByText("Light").closest(".flex-1") as HTMLElement;
    const metricsContainer = lightBox.querySelector(".mt-4");
    const rowTexts = Array.from(metricsContainer?.children ?? []).map((row) => row.textContent);

    expect(rowTexts).toEqual([
      "Operating StatusOFF",
      "Expected ON @ 19:54 EDT",
      "48H Average Light %11.3%",
      "Light Power 145",
      "Light Power 246",
    ]);
  });


  it("resolves a winter (-05:00) offset to EST (not EDT), since daylight saving isn't active in January", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: "2026-01-15 17:30:00-05:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Expected ON @ 17:30 EST")).toBeInTheDocument();
  });

  it("resolves a -05:00 offset to CDT (not EST) in August, since Central Daylight also uses -05:00 in summer", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: "2026-08-28 20:15:00-05:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Expected ON @ 20:15 CDT")).toBeInTheDocument();
  });

  it("does not show the sunset expectation when lightStatusText is not OFF, even if sunsetTime is present", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "ON",
              sunsetTime: "2026-08-28 19:54:31.130526-04:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/Expected ON/)).not.toBeInTheDocument();
  });

  it("does not show the sunset expectation when sunsetTime is null, even if lightStatusText is OFF", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: null,
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/Expected ON/)).not.toBeInTheDocument();
  });

  it("does not show a sunset expectation on the Panel, Battery, or Issue Entry cards", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            {
              ...vitals.projects[0].poles[0],
              lightStatusText: "OFF",
              sunsetTime: "2026-08-28 19:54:31.130526-04:00",
            },
          ],
        },
      ],
    });
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const expectedOn = screen.getByText("Expected ON @ 19:54 EDT");
    const lightBox = screen.getByText("Light").closest(".flex-1") as HTMLElement;
    expect(lightBox).toContainElement(expectedOn);
    const panelBox = screen.getByText("Panel").closest(".flex-1") as HTMLElement;
    const batteryBox = screen.getByText("Battery").closest(".flex-1") as HTMLElement;
    const issueBox = screen.getByText("Issue Entry").closest(".flex-1") as HTMLElement;
    expect(within(panelBox).queryByText(/Expected ON/)).not.toBeInTheDocument();
    expect(within(batteryBox).queryByText(/Expected ON/)).not.toBeInTheDocument();
    expect(within(issueBox).queryByText(/Expected ON/)).not.toBeInTheDocument();
  });

  it("shows both the new status-label metrics and the restored old detailed metric set for a Streetleaf Admin, none of them prefixed", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // New status-label metrics, no prefix.
    const operatingStatuses = screen.getAllByText("Operating Status");
    expect(operatingStatuses).toHaveLength(3);
    for (const label of operatingStatuses) {
      expect(label.nextElementSibling).toHaveTextContent("OK");
    }
    expect(screen.getByText("Battery Percentage").nextElementSibling).toHaveTextContent("0");
    expect(screen.queryByText("Electric Current")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Operating Status")).not.toBeInTheDocument();
    expect(screen.queryByText("Last Known Operating Status")).not.toBeInTheDocument();

    // Restored old detailed metrics, also no prefix.
    expect(screen.getByText("48H Average Light %").nextElementSibling).toHaveTextContent("11.3%");
    expect(screen.getByText("Light Power 1").nextElementSibling).toHaveTextContent("45");
    expect(screen.getByText("Light Power 2").nextElementSibling).toHaveTextContent("46");
    expect(screen.getByText("48H Average Panel %").nextElementSibling).toHaveTextContent("10.8%");
    expect(screen.getByText("Panel Voltage").nextElementSibling).toHaveTextContent("18.565V");
    expect(screen.getByText("Panel Electric Current").nextElementSibling).toHaveTextContent(
      "4.443",
    );
    expect(screen.getByText("48H Average Battery %").nextElementSibling).toHaveTextContent(
      "90.4%",
    );
    expect(screen.getByText("Electric Current 1").nextElementSibling).toHaveTextContent("90");
    expect(screen.getByText("Electric Current 2").nextElementSibling).toHaveTextContent("100");
    expect(screen.getByText("Battery Voltage 1").nextElementSibling).toHaveTextContent("13.509V");
    expect(screen.getByText("Battery Voltage 2").nextElementSibling).toHaveTextContent("13.785V");
  });

  it("positions Battery Percentage directly above Electric Current 1 & 2 in the Battery box, for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const batteryBox = screen.getByText("Battery").closest(".flex-1") as HTMLElement;
    const metricsContainer = batteryBox.querySelector(".mt-4");
    const rowLabels = Array.from(metricsContainer?.children ?? []).map(
      (row) => row.firstElementChild?.textContent,
    );

    expect(rowLabels).toEqual([
      "Operating Status",
      "48H Average Battery %",
      "Battery Percentage",
      "Electric Current 1",
      "Electric Current 2",
      "Battery Voltage 1",
      "Battery Voltage 2",
    ]);
  });

  it("does not show the old detailed metric set for a Customer Admin — only the simplified status-label metrics", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Customer Admin", customerId: "r2" });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("48H Average Light %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Light Power 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Light Power 2")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Average Panel %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Panel Voltage")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Panel Electric Current")).not.toBeInTheDocument();
    expect(screen.queryByText("48H Average Battery %")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Electric Current 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Electric Current 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Battery Voltage 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Battery Voltage 2")).not.toBeInTheDocument();
  });

  it("renders a not-found state when the customer doesn't exist", async () => {
    getCustomerMock.mockResolvedValue(undefined);
    getProjectsForCustomerMock.mockResolvedValue([]);
    getPoleVitalsForCustomerMock.mockResolvedValue(undefined);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "does-not-exist", projectId: "p1", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Pole not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Customers" })).toHaveAttribute(
      "href",
      "/customers",
    );
  });

  it("renders a not-found state when the project doesn't exist", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "does-not-exist", poleId: "pole1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Pole not found" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Coastal Power & Light" }),
    ).toHaveAttribute("href", "/customers/r2");
  });

  it("renders a not-found state when the pole id doesn't match", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await PoleDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1", poleId: "does-not-exist" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Pole not found" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Bayou District Rebuild" }),
    ).toHaveAttribute("href", "/customers/r2/projects/p1");
  });
});
