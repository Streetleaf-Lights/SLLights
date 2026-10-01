import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Customer, CustomerPoleVitals, Project } from "@/lib/types";

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

// Most tests here don't care about role; default to a Streetleaf Admin so
// the leading breadcrumb renders normally unless a test overrides this.
getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });

import CustomerDetailPage from "@/app/customers/[id]/page";

const customer: Customer = {
  id: "r2",
  name: "Coastal Power & Light",
  projects: [
    { id: "p1", name: "Bayou District Rebuild" },
    { id: "p2", name: "Storm Hardening Phase 2" },
  ],
  address: "412 Harbor Ave",
  city: "New Orleans",
  state: "LA",
  zip: "70115",
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
  percentWorking: 100.0,
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

describe("CustomerDetailPage", () => {
  it("renders the customer name as the heading", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Coastal Power & Light" })).toBeInTheDocument();
  });

  it("does not repeat the customer name in the breadcrumb — it's already the page heading", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(
      within(screen.getByRole("navigation")).queryByText("Coastal Power & Light"),
    ).not.toBeInTheDocument();
    // The heading still shows it, exactly once, outside the breadcrumb.
    expect(screen.getAllByText("Coastal Power & Light")).toHaveLength(1);
  });

  it("renders the initials avatar in the header", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("CP")).toBeInTheDocument();
  });

  it("renders the combined address line below the customer name", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(
      screen.getByText("412 Harbor Ave, New Orleans, LA 70115"),
    ).toBeInTheDocument();
  });

  it("omits the address line entirely when no address fields are set", async () => {
    getCustomerMock.mockResolvedValue({
      ...customer,
      address: null,
      city: null,
      state: null,
      zip: null,
    });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/Harbor Ave/)).not.toBeInTheDocument();
  });

  it("shows the project count in the header, from the real /getProjects list", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("2 Projects")).toBeInTheDocument();
  });

  it("uses the singular 'Project' label when there is exactly one", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([projects[0]]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("1 Project")).toBeInTheDocument();
  });

  it("renders the phone number in the header", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("504-555-0132")).toBeInTheDocument();
  });

  it("omits the phone line when there is no phone on file", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, phone: null });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("504-555-0132")).not.toBeInTheDocument();
  });

  it("does not render the stub notice or the customer id anywhere", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/This is a stub detail page/)).not.toBeInTheDocument();
    expect(screen.queryByText("r2")).not.toBeInTheDocument();
  });

  it("does not show '(Inactive)' next to the customer name when the customer is active", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("shows '(Inactive)' in orange next to the customer name when the customer is not active", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: false });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const badge = screen.getByText("(Inactive)");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("text-[var(--status-warning)]");
    // Sits right next to the customer name, inside the same heading.
    expect(screen.getByRole("heading", { name: /Coastal Power & Light/ })).toContainElement(
      badge,
    );
  });

  it("does not show '(Inactive)' when active is undefined (regression: was showing Inactive on a customer's first-ever fetch, before some upstream cache/propagation delay resolved) — undefined only means 'not explicitly known to be inactive', not inactive", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: undefined });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("does not show '(Inactive)' when active is null", async () => {
    getCustomerMock.mockResolvedValue({ ...customer, active: null });
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("(Inactive)")).not.toBeInTheDocument();
  });

  it("shows a Summary box with real totalLights/percentWorking/totalFaults from /getPoleVitals", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("Summary")).toBeInTheDocument();
    const summaryHeading = screen.getByText("Summary");
    const summaryRow = within(summaryHeading.parentElement as HTMLElement);
    expect(summaryRow.getByLabelText("88 Total lights")).toBeInTheDocument();
    // percentWorking 100.0 -> "100%", label stays "Lights working"
    expect(summaryRow.getByLabelText("100% Lights working")).toBeInTheDocument();
    expect(summaryRow.getByLabelText("2 Total faults")).toBeInTheDocument();
  });

  it("does not color-code Lights working, at any percentage", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      percentWorking: 42,
    });
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const summaryWorking = screen.getByLabelText("42% Lights working");
    const valueClass = summaryWorking.querySelector("div")?.className ?? "";
    expect(valueClass).not.toContain("status-active");
    expect(valueClass).not.toContain("status-flagged");
    expect(valueClass).not.toContain("status-warning");
  });

  it("does not crash and shows a dash when percentWorking is missing from the API response", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to omit percentWorking
    const { percentWorking: _percentWorking, ...vitalsWithoutPercentWorking } = vitals;
    getPoleVitalsForCustomerMock.mockResolvedValue(vitalsWithoutPercentWorking);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const summaryHeading = screen.getByText("Summary");
    const summaryRow = within(summaryHeading.parentElement as HTMLElement);
    const summaryWorking = summaryRow.getByLabelText("— Lights working");
    expect(summaryWorking).toBeInTheDocument();
    expect(summaryWorking.querySelector("div")?.className).not.toContain("status-active");
    expect(summaryWorking.querySelector("div")?.className).not.toContain("status-flagged");
  });

  it("shows stub dashes when no vitals are available for this customer", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(undefined);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByLabelText("0 Total lights")).toBeInTheDocument();
    const summaryHeading = screen.getByText("Summary");
    const summaryRow = within(summaryHeading.parentElement as HTMLElement);
    expect(summaryRow.getByLabelText("— Lights working")).toBeInTheDocument();
    expect(summaryRow.getByLabelText("— Total faults")).toBeInTheDocument();
  });

  it("shows each project's own vitals (from the nested projects array) next to its name", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    const rowStat = within(row1).getByLabelText("54 Total lights");
    expect(rowStat).toBeInTheDocument();
    // p1's connectedLights is 51
    const row1Connected = within(row1).getByLabelText("51 Connected lights");
    expect(row1Connected).toBeInTheDocument();
    expect(within(row1).getByLabelText("1 Total faults")).toBeInTheDocument();
    // The stat itself is one column inside a shared box — the box (its
    // grandparent) carries the border/rounded styling, not each column.
    const box = rowStat.parentElement?.parentElement;
    expect(box?.className).toContain("rounded-lg");
    expect(box?.className).toContain("border");
    // Uses the smaller size in row context.
    expect(rowStat.querySelector("div")?.className).toContain("text-[13px]");

    const row2 = screen
      .getByRole("link", { name: /Storm Hardening Phase 2/ })
      .closest("div") as HTMLElement;
    expect(within(row2).getByLabelText("34 Total lights")).toBeInTheDocument();
    expect(within(row2).getByLabelText("34 Connected lights")).toBeInTheDocument();
  });

  it("shows dashes for a project row when no matching vitals are found", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, projects: [] });
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    expect(within(row1).getByLabelText("— Total lights")).toBeInTheDocument();
    expect(within(row1).getByLabelText("— Connected lights")).toBeInTheDocument();
    expect(within(row1).getByLabelText("— Total faults")).toBeInTheDocument();
  });

  it("hides Connected lights when the viewer is a Customer Admin, even viewing their own customer", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "r2",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByLabelText(/Connected lights/)).not.toBeInTheDocument();
    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    expect(within(row1).getByLabelText("54 Total lights")).toBeInTheDocument();
    expect(within(row1).getByLabelText("1 Total faults")).toBeInTheDocument();
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
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByLabelText(/Connected lights/)).not.toBeInTheDocument();
  });

  it("still shows Connected lights for a Streetleaf Admin, even when browsing a Customer Admin's own customer", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    expect(within(row1).getByLabelText("51 Connected lights")).toBeInTheDocument();
  });

  it("does not render a Project ID column", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText("p1")).not.toBeInTheDocument();
    expect(screen.queryByText("p2")).not.toBeInTheDocument();
  });

  it("shows the Projects section heading outside any bordered box", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const sectionHeadings = screen
      .getAllByText("Projects")
      .filter((el) => el.className.includes("mb-3"));
    expect(sectionHeadings).toHaveLength(1);
    expect(sectionHeadings[0].closest(".rounded-lg")).toBeNull();
  });

  it("does not wrap the project list itself in a bordered box", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const projectLink = screen.getByRole("link", { name: /Bayou District Rebuild/ });
    // Each row has its own small border, but there should be no enclosing
    // rounded-lg box wrapping the whole stacked list.
    expect(projectLink.parentElement?.className).not.toContain("rounded-lg");
  });

  it("links each project to its detail page", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("link", { name: /Bayou District Rebuild/ })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1",
    );
  });

  it("links a project's Total faults stat to the faulted-poles view for that project, when it has faults", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // Bayou District Rebuild (p1) has totalFaults: 1 — scope to its own
    // row, since Storm Hardening Phase 2 (p2) also has totalFaults: 1.
    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    const faultsLink = within(row1).getByRole("link", { name: "1 Total faults" });
    expect(faultsLink).toHaveAttribute("href", "/poles?customerId=r2&projectId=p1&faults=1");
  });

  it("uses a recognizable (red/flagged) color for a project's Total faults link, distinct from ordinary links", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const row1 = screen
      .getByRole("link", { name: /Bayou District Rebuild/ })
      .closest("div") as HTMLElement;
    const faultsLink = within(row1).getByRole("link", { name: "1 Total faults" });
    expect(faultsLink.querySelector("div")?.className).toContain(
      "text-[var(--status-flagged)]",
    );
  });

  it("links the customer-level aggregate Total faults (Summary box) to every project's faulted poles, omitting projectId", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    // customer.totalFaults is 2 in this fixture's vitals.
    const faultsLink = screen.getByRole("link", { name: "2 Total faults" });
    expect(faultsLink).toHaveAttribute("href", "/poles?customerId=r2&faults=1");
    expect(faultsLink.querySelector("div")?.className).toContain(
      "text-[var(--status-flagged)]",
    );
  });

  it("does not link the customer-level aggregate Total faults when it's zero", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, totalFaults: 0 });
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("link", { name: "0 Total faults" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("0 Total faults")).toBeInTheDocument();
  });

  it("does not link Total faults when a project has zero faults", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({
      ...vitals,
      projects: [{ ...vitals.projects[0], totalFaults: 0 }, vitals.projects[1]],
    });
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("link", { name: "0 Total faults" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("0 Total faults")).toBeInTheDocument();
  });

  it("does not link Total faults when there's no matching vitals row for a project (shows a dash)", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue({ ...vitals, projects: [] });
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByRole("link", { name: "— Total faults" })).not.toBeInTheDocument();
  });

  it("still lets the project name/dot navigate to the project detail page even though Total faults is now its own separate link", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    const nameLink = screen.getByRole("link", { name: /Bayou District Rebuild/ });
    const row1 = nameLink.closest("div") as HTMLElement;
    const faultsLink = within(row1).getByRole("link", { name: "1 Total faults" });
    expect(nameLink).toHaveAttribute("href", "/customers/r2/projects/p1");
    // Two distinct links, not one link wrapping both — confirms no nested <a> tags.
    expect(nameLink).not.toBe(faultsLink);
  });

  it("restores the search in the breadcrumb's Customers link, and carries it into forward-going project links", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({ cust_q: "coastal" }),
    });
    render(jsx);

    expect(
      screen.getByRole("link", { name: "\u2190 Customer Search: \u201ccoastal\u201d" }),
    ).toHaveAttribute("href", "/customers?cust_q=coastal");
    expect(screen.getByRole("link", { name: /Bayou District Rebuild/ })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1?cust_q=coastal",
    );
  });

  it("shows the Poles breadcrumb (not Customers) when arriving via a pole search, restores it, and carries pole_q forward", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({ pole_q: "12057" }),
    });
    render(jsx);

    expect(
      screen.getByRole("link", { name: "\u2190 Pole Search: \u201c12057\u201d" }),
    ).toHaveAttribute("href", "/poles?pole_q=12057");
    expect(screen.queryByText(/Customer Search/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Bayou District Rebuild/ })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1?pole_q=12057",
    );
  });

  it("shows a message when the customer has no projects", async () => {
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue([]);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "r2" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByText("No projects on file for this customer yet.")).toBeInTheDocument();
  });

  it("renders a not-found state when the customer doesn't exist", async () => {
    getCustomerMock.mockResolvedValue(undefined);
    const jsx = await CustomerDetailPage({
      params: Promise.resolve({ id: "does-not-exist" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Customer not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Customers" })).toHaveAttribute(
      "href",
      "/customers",
    );
    // The heading already says "not found" — the breadcrumb shouldn't repeat it.
    expect(within(screen.getByRole("navigation")).queryByText("Not found")).not.toBeInTheDocument();
  });
});
