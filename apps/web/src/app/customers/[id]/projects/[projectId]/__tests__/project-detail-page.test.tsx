import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Customer, CustomerPoleVitals, LeadsunProject, Project } from "@/lib/types";

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

// LocationMap (used directly here) loads the real Google Maps JS API
// otherwise — not appropriate for a page-level integration test, and the
// map's own internals are already covered by LocationMap.test.tsx.
vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn(() => new Promise(() => {})),
}));

import ProjectDetailPage from "@/app/customers/[id]/projects/[projectId]/page";

const customer: Customer = {
  id: "r2",
  name: "Coastal Power & Light",
  projects: [
    { id: "p1", name: "Bayou District Rebuild" },
    { id: "p2", name: "Storm Hardening Phase 2" },
  ],
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
  {
    id: "p2",
    name: "Storm Hardening Phase 2",
    leadsunProject: null,
    active: true,
  },
];

const vitals: CustomerPoleVitals = {
  id: "r2",
  name: "Coastal Power & Light",
  totalLights: 88,
  connectedLights: 84,
  totalFaults: 2,
  percentWorking: 96.0,
  poles: [],
  projects: [
    {
      id: "p1",
      name: "Bayou District Rebuild",
      totalLights: 54,
      connectedLights: 51,
      totalFaults: 1,
      percentWorking: 92.5,
      poles: [
        { id: "pv1", poleNumber: "51079-1000", locationId: "loc-1", active: true, isOnline: true, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: null, overallStatusText: null, isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
        { id: "pv2", poleNumber: "51079-1001", locationId: "loc-2", active: true, isOnline: true, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: null, overallStatusText: null, isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
        { id: "pv3", poleNumber: "51079-1002", locationId: "loc-3", active: true, isOnline: false, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: null, overallStatusText: null, isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
      ],
    },
    {
      id: "p2",
      name: "Storm Hardening Phase 2",
      totalLights: 34,
      connectedLights: 34,
      totalFaults: 1,
      percentWorking: 100.0,
      poles: [],
    },
  ],
};

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", "test-map-id");
    getSessionUserMock.mockReset();
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the project name as the heading", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Bayou District Rebuild" })).toBeInTheDocument();
  });

  it("renders the breadcrumb trail: Customers / Customer / Project", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
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
  });

  it("does not repeat the project name in the breadcrumb — it's already the page heading", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const breadcrumb = within(screen.getByRole("navigation"));
    expect(breadcrumb.queryByText("Bayou District Rebuild")).not.toBeInTheDocument();
    // The heading still shows it, exactly once, outside the breadcrumb.
    expect(screen.getAllByText("Bayou District Rebuild")).toHaveLength(1);
  });

  it("carries pole_q into the Poles table's pole links", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({ pole_q: "12057" }),
    });
    render(jsx);

    expect(screen.getByRole("link", { name: "51079-1000" })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1/poles/pv1?pole_q=12057",
    );
  });

  it("restores the search in the top-level Customers breadcrumb, and the customer crumb still carries it too", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
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
  });

  it("shows the Poles breadcrumb (not Customers) when arriving via a pole search, restores it, and carries pole_q into the customer crumb", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
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
  });

  it("shows the customer name above the project name as plain text (not a link)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // Still appears in the breadcrumb as a link; the header copy is plain text.
    const breadcrumbLink = within(screen.getByRole("navigation")).getByRole("link", {
      name: "Coastal Power & Light",
    });
    expect(breadcrumbLink).toHaveAttribute("href", "/customers/r2");

    const customerTexts = screen.getAllByText("Coastal Power & Light");
    expect(customerTexts).toHaveLength(2);
    const headerCustomerText = customerTexts.find((el) => !el.closest("nav"));
    expect(headerCustomerText).toBeTruthy();
    expect(headerCustomerText!.tagName).not.toBe("A");
    expect(headerCustomerText!.closest("a")).toBeNull();

    const heading = screen.getByRole("heading", { name: "Bayou District Rebuild" });
    // The customer name sits before the heading in the DOM (above it).
    expect(
      headerCustomerText!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("colors the header's customer name teal", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const headerCustomerText = screen
      .getAllByText("Coastal Power & Light")
      .find((el) => !el.closest("nav"));
    expect(headerCustomerText?.className).toContain("text-[var(--accent)]");
  });

  it("does not render the stub notice", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/stub detail page/i)).not.toBeInTheDocument();
  });

  it("does not render the customer/project-id info box", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("Project ID")).not.toBeInTheDocument();
    expect(screen.queryByText("p1")).not.toBeInTheDocument();
  });

  it("shows a Light Status section with this project's real vitals", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // Now that the Poles table no longer has a "Working" column, "Light
    // Status" only appears once, as this section's heading.
    expect(screen.getByText("Light Status")).toBeInTheDocument();
    expect(screen.getByLabelText("54 Total lights")).toBeInTheDocument();
    expect(screen.getByLabelText("51 Connected lights")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Total faults")).toBeInTheDocument();
  });

  it("shows a different project's own vitals when viewing that project", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("34 Total lights")).toBeInTheDocument();
    expect(screen.getByLabelText("34 Connected lights")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Total faults")).toBeInTheDocument();
  });

  it("links the Total faults stat to the faulted-poles view for this project, when it has faults", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const faultsLink = screen.getByRole("link", { name: "1 Total faults" });
    expect(faultsLink).toHaveAttribute("href", "/poles?customerId=r2&projectId=p1&faults=1");
  });

  it("uses a recognizable (red/flagged) color for the Total faults link, distinct from ordinary links", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const faultsLink = screen.getByRole("link", { name: "1 Total faults" });
    expect(faultsLink.querySelector("div")?.className).toContain(
      "text-[var(--status-flagged)]",
    );
  });

  it("does not link Total faults when this project has zero faults", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [{ ...vitals.projects[0], totalFaults: 0 }, vitals.projects[1]],
    });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("link", { name: "0 Total faults" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("0 Total faults")).toBeInTheDocument();
  });

  it("does not link Total faults when there's no matching vitals for this project (shows a dash)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, projects: [] });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("link", { name: "— Total faults" })).not.toBeInTheDocument();
  });

  it("hides Connected lights in Light Status when the viewer is a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "r2",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByLabelText(/Connected lights/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("54 Total lights")).toBeInTheDocument();
    expect(screen.getByLabelText("1 Total faults")).toBeInTheDocument();
  });

  it("hides Connected lights when the viewer is a 'Customer User' (role User, with a customerId)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u2",
      role: "User",
      customerId: "r2",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByLabelText(/Connected lights/)).not.toBeInTheDocument();
  });

  it("still shows Connected lights for a Streetleaf Admin browsing a Customer Admin's own customer/project", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("51 Connected lights")).toBeInTheDocument();
  });

  it("hides the pole list's 48h Connected column and shows 'Overall Status' (no '48h') for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "r2",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "48h Connected" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Overall Status" })).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "48h Overall Status" }),
    ).not.toBeInTheDocument();
  });

  it("hides the pole list's 48h Connected column for a 'Customer User' too", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u2",
      role: "User",
      customerId: "r2",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "48h Connected" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Overall Status" })).toBeInTheDocument();
  });

  it("still shows the pole list's 48h Connected column and '48h Overall Status' label for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("columnheader", { name: "48h Connected" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "48h Overall Status" })).toBeInTheDocument();
  });

  it("shows a Poles section listing this project's poles", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Poles")).toBeInTheDocument();
    expect(screen.getByText("51079-1000")).toBeInTheDocument();
    expect(screen.getByText("51079-1002")).toBeInTheDocument();
  });

  it("does not show '(Inactive)' anywhere when both the customer and project are active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("shows '(Inactive)' next to the customer name only, when the customer is inactive but the project is active", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: false });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const badges = screen.getAllByText("(Inactive)");
    expect(badges).toHaveLength(1);
    expect(badges[0].className).toContain("text-[var(--status-warning)]");
    const customerLine = badges[0].closest("p");
    expect(customerLine).toHaveTextContent("Coastal Power & Light");
  });

  it("shows '(Inactive)' next to the project name only, when the project is inactive but the customer is active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], active: false }, projects[1]]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const badges = screen.getAllByText("(Inactive)");
    expect(badges).toHaveLength(1);
    const projectHeading = screen.getByRole("heading", { name: /Bayou District Rebuild/ });
    expect(projectHeading).toContainElement(badges[0]);
  });

  it("shows '(Inactive)' next to both the customer and project names when both are inactive", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: false });
    getProjectsForCustomerMock.mockResolvedValue([{ ...projects[0], active: false }, projects[1]]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getAllByText("(Inactive)")).toHaveLength(2);
  });

  it("does not show '(Inactive)' when customer.active or project.active is undefined (regression: treating missing data as inactive caused false positives on first-ever loads)", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: undefined });
    getProjectsForCustomerMock.mockResolvedValue([
      { ...projects[0], active: undefined },
      projects[1],
    ]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
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
              ProductName: "51079-1000",
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
      const jsx = await ProjectDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.queryByRole("button", { name: "Remote Control" })).not.toBeInTheDocument();
    });

    it("does not show a Remote Control link when leadsunProject has zero products anywhere", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([
        { ...projects[0], leadsunProject: { ...leadsunProject, groups: [] } },
        projects[1],
      ]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await ProjectDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.queryByRole("button", { name: "Remote Control" })).not.toBeInTheDocument();
    });

    it("shows a Remote Control link on the right of the header when the project has at least one product", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([
        { ...projects[0], leadsunProject },
        projects[1],
      ]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await ProjectDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      expect(screen.getByRole("button", { name: "Remote Control" })).toBeInTheDocument();
    });

    it("opens the stub modal when the header's Remote Control link is clicked", async () => {
      getCustomerMock.mockResolvedValue(customer);
      getProjectsForCustomerMock.mockResolvedValue([
        { ...projects[0], leadsunProject },
        projects[1],
      ]);
      getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
      const jsx = await ProjectDetailPage({
        params: Promise.resolve({ id: "r2", projectId: "p1" }),
        searchParams: Promise.resolve({}),
      });
      render(jsx);

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("shows the Poles empty state for a project with no poles", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("No poles on file for this project yet.")).toBeInTheDocument();
  });

  it("shows the Poles empty state when there are no vitals for this project at all", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, projects: [] });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("No poles on file for this project yet.")).toBeInTheDocument();
  });

  it("shows dashes when no vitals are available for this project", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, projects: [] });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("— Total lights")).toBeInTheDocument();
    expect(screen.getByLabelText("— Connected lights")).toBeInTheDocument();
    expect(screen.getByLabelText("— Total faults")).toBeInTheDocument();
  });

  it("renders a not-found state when the customer doesn't exist", async () => {
    getCustomerMock.mockResolvedValue(undefined);
    getProjectsForCustomerMock.mockResolvedValue([]);
    getPoleVitalsForCustomerMock.mockResolvedValue(undefined);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "does-not-exist", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Project not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Customers" })).toHaveAttribute(
      "href",
      "/customers",
    );
  });

  it("renders a not-found state when the project id doesn't match", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "does-not-exist" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Project not found" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Coastal Power & Light" }),
    ).toHaveAttribute("href", "/customers/r2");
    // The heading already says "not found" — the breadcrumb shouldn't repeat it.
    expect(within(screen.getByRole("navigation")).queryByText("Not found")).not.toBeInTheDocument();
  });

  it("shows a Location section with a map container when the project's poles have coordinates", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            { ...vitals.projects[0].poles[0], lat: 29.9511, long: -90.0715 },
            { ...vitals.projects[0].poles[1], lat: 29.9611, long: -90.0815 },
          ],
        },
        vitals.projects[1],
      ],
    });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByRole("application", { name: "Map" })).toBeInTheDocument();
  });

  it("excludes poles with undefined (not just null) coordinates from the map, without crashing", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [
        {
          ...vitals.projects[0],
          poles: [
            { ...vitals.projects[0].poles[0], lat: 29.9511, long: -90.0715 },
            { ...vitals.projects[0].poles[1], lat: undefined, long: undefined },
          ],
        },
        vitals.projects[1],
      ],
    });
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("application", { name: "Map" })).toBeInTheDocument();
  });

  it("places the Location section above the Poles section", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const locationHeading = screen.getByText("Location");
    const polesHeading = screen.getByText("Poles");
    expect(
      locationHeading.compareDocumentPosition(polesHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows an empty-location message instead of a map when none of the project's poles have coordinates", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p1" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(
      screen.getByText("No poles have location data for this project."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("application", { name: "Map" })).not.toBeInTheDocument();
  });

  it("shows an empty-location message when the project has no poles at all", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await ProjectDetailPage({
      params: Promise.resolve({ id: "r2", projectId: "p2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(
      screen.getByText("No poles have location data for this project."),
    ).toBeInTheDocument();
  });
});
