import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

vi.mock("@/lib/session", () => ({
  getSessionUser: getSessionUserMock,
  getSessionToken: getSessionTokenMock,
}));

import ProjectsPage from "@/app/projects/page";

const customer: Customer = {
  id: "rec5uaHZMOGZGyVcY",
  name: "Coastal Power & Light",
  projects: [],
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
];

const vitals: CustomerPoleVitals = {
  id: "rec5uaHZMOGZGyVcY",
  name: "Coastal Power & Light",
  totalLights: 54,
  connectedLights: 51,
  totalFaults: 1,
  percentWorking: 92.5,
  poles: [],
  projects: [
    {
      id: "p1",
      name: "Bayou District Rebuild",
      totalLights: 54,
      connectedLights: 51,
      totalFaults: 1,
      percentWorking: 92.5,
      poles: [],
    },
  ],
};

describe("ProjectsPage", () => {
  beforeEach(() => {
    getCustomerMock.mockReset();
    getProjectsForCustomerMock.mockReset();
    getPoleVitalsForCustomerMock.mockReset();
    getSessionUserMock.mockReset();
  });

  it("looks up the customer using the session's own customerId", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);

    await ProjectsPage();

    expect(getCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
    expect(getProjectsForCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
    expect(getPoleVitalsForCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
  });

  it("works the same for a 'Customer User' (role User, with a customerId) — this page was never role-gated, just customerId-driven", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u2",
      role: "User",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(getCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
  });

  it("renders the same customer overview content as the customer detail page", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
    expect(screen.getByText("412 Harbor Ave, New Orleans, LA 70115")).toBeInTheDocument();
    expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
  });

  it("hides the Connected lights stat from each project row (unlike the customer detail page)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(screen.queryByText("Connected lights")).not.toBeInTheDocument();
    // The other two stats on that same row are unaffected.
    expect(screen.getAllByText("Total lights").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total faults").length).toBeGreaterThan(0);
  });

  it("does not render a breadcrumb (it's a primary nav destination, not a drill-down page)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getCustomerMock.mockResolvedValue(customer);
    getProjectsForCustomerMock.mockResolvedValue(projects);
    getPoleVitalsForCustomerMock.mockResolvedValue(vitals);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows a not-found message when there is no session", async () => {
    getSessionUserMock.mockResolvedValue(null);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(
      screen.getByText(/couldn.t find a customer associated with your account/),
    ).toBeInTheDocument();
    expect(getCustomerMock).not.toHaveBeenCalled();
  });

  it("shows a not-found message when the session has no customerId", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "Streetleaf Admin", customerId: null });

    const jsx = await ProjectsPage();
    render(jsx);

    expect(
      screen.getByText(/couldn.t find a customer associated with your account/),
    ).toBeInTheDocument();
    expect(getCustomerMock).not.toHaveBeenCalled();
  });

  it("shows a not-found message when the customer lookup itself comes back empty", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec-does-not-exist",
    });
    getCustomerMock.mockResolvedValue(undefined);

    const jsx = await ProjectsPage();
    render(jsx);

    expect(
      screen.getByText(/couldn.t find a customer associated with your account/),
    ).toBeInTheDocument();
    expect(getProjectsForCustomerMock).not.toHaveBeenCalled();
  });
});
