import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PoleSummary } from "@/lib/types";

const {
  getPolesMock,
  getCustomerMock,
  getProjectsForCustomerMock,
  getSessionUserMock,
  getSessionTokenMock,
} = vi.hoisted(() => ({
  getPolesMock: vi.fn(),
  getCustomerMock: vi.fn(),
  getProjectsForCustomerMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionTokenMock: vi.fn().mockResolvedValue("jwt-token"),
}));

vi.mock("@/lib/apim", () => ({
  getPoles: getPolesMock,
  getCustomer: getCustomerMock,
  getProjectsForCustomer: getProjectsForCustomerMock,
}));

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    getSessionUser: getSessionUserMock,
    getSessionToken: getSessionTokenMock,
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import PolesPage from "@/app/poles/page";

const poles: PoleSummary[] = [
  {
    id: "p1",
    poleNumber: "51079-1000",
    locationId: "loc-1",
    active: true,
    installDate: null,
    lat: null,
    long: null,
    lastUpdate: null,
    isOnline: true,
    avgBatteryPercentage: null,
    avgPanelPercentage: null,
    avgLightPercentage: null,
    sunsetTime: null,
    lightStatusText: null,
    panelStatusText: null,
    panelIdleReason: null,
    batteryStatusText: null,
    electricCurrentAverage: null, connectedText: null, overallStatusText: null,
    lampPower1: null,
    lampPower2: null,
    batteryElecCurrent1: null,
    batteryElecCurrent2: null,
    solarBoardVoltage: null,
    solarBoardElecCurrent: null,
    isLedFault: null,
    isBatteryFault: null,
    isPanelFault: null,
    isOpenIssueFault: null,
    isPoleFault: null, poleIssues: [],
    projectId: "proj-1",
    customerId: "rec5uaHZMOGZGyVcY",
  },
];

const projectPoles: PoleSummary[] = [
  {
    ...poles[0],
    id: "fp1",
    poleNumber: "51079-2000",
    isPoleFault: true, poleIssues: [],
    lastUpdate: new Date().toISOString(),
  },
  {
    ...poles[0],
    id: "fp2",
    poleNumber: "51079-2001",
    isPoleFault: false, poleIssues: [],
    lastUpdate: new Date().toISOString(),
  },
  {
    ...poles[0],
    id: "fp3",
    poleNumber: "51079-2002",
    isPoleFault: null, poleIssues: [],
    lastUpdate: new Date().toISOString(),
  },
  // Faulted, but never reported at all — should be excluded.
  { ...poles[0], id: "fp4", poleNumber: "51079-2003", isPoleFault: true, poleIssues: [], lastUpdate: null },
  // Faulted, but last reported more than 48h ago — should also be excluded.
  {
    ...poles[0],
    id: "fp5",
    poleNumber: "51079-2004",
    isPoleFault: true, poleIssues: [],
    lastUpdate: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

const faultsCustomer = {
  id: "rec5uaHZMOGZGyVcY",
  name: "Coastal Power & Light",
  projects: [],
  address: null,
  city: null,
  state: null,
  zip: null,
  phone: null,
  active: true,
  createdAt: "2026-01-01",
};

const faultsProjects = [
  {
    id: "proj-1",
    name: "Bayou District Rebuild",
    customerId: "rec5uaHZMOGZGyVcY",
    poleNumbers: [],
    poleIds: [],
    polesUnderContract: 0,
    effectiveDate: "2026-01-01",
    installDates: [],
    createdAt: "2026-01-01",
  },
];

describe("PolesPage", () => {
  beforeEach(() => {
    getPolesMock.mockReset();
    getCustomerMock.mockReset();
    getProjectsForCustomerMock.mockReset();
    getSessionUserMock.mockReset();
  });

  it("fetches all poles (no filter) when no session is present", async () => {
    getSessionUserMock.mockResolvedValue(null);
    getPolesMock.mockResolvedValue(poles);

    await PolesPage({ searchParams: Promise.resolve({}) });

    expect(getPolesMock).toHaveBeenCalledWith(undefined, "jwt-token");
  });

  it("shows no description text below the page title", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getPolesMock.mockResolvedValue(poles);

    const jsx = await PolesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "Poles" })).toBeInTheDocument();
    expect(screen.queryByText(/Every pole/)).not.toBeInTheDocument();
  });

  it("fetches all poles (no filter) for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getPolesMock.mockResolvedValue(poles);

    await PolesPage({ searchParams: Promise.resolve({}) });

    expect(getPolesMock).toHaveBeenCalledWith(undefined, "jwt-token");
  });

  it("scopes poles to the Customer Admin's own customer", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getPolesMock.mockResolvedValue(poles);

    await PolesPage({ searchParams: Promise.resolve({}) });

    expect(getPolesMock).toHaveBeenCalledWith({ customerId: "rec5uaHZMOGZGyVcY" }, "jwt-token");
  });

  it("hides the 48h Connected column and shows 'Overall Status' (no '48h') for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getPolesMock.mockResolvedValue(poles);

    const jsx = await PolesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "48h Connected" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Overall Status" })).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "48h Overall Status" }),
    ).not.toBeInTheDocument();
  });

  it("still shows the 48h Connected column and '48h Overall Status' label for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getPolesMock.mockResolvedValue(poles);

    const jsx = await PolesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("columnheader", { name: "48h Connected" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "48h Overall Status" })).toBeInTheDocument();
  });

  it("scopes poles to a 'Customer User's own customer, same as a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u2",
      role: "User",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getPolesMock.mockResolvedValue(poles);

    await PolesPage({ searchParams: Promise.resolve({}) });

    expect(getPolesMock).toHaveBeenCalledWith({ customerId: "rec5uaHZMOGZGyVcY" }, "jwt-token");
  });

  it("fetches all poles (no filter) for a 'Streetleaf User' (role User, no customerId) — same as a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u3",
      role: "User",
      customerId: null,
    });
    getPolesMock.mockResolvedValue(poles);

    await PolesPage({ searchParams: Promise.resolve({}) });

    expect(getPolesMock).toHaveBeenCalledWith(undefined, "jwt-token");
  });

  it("does not show Customer/Project columns on a normal (non-faults) visit", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getPolesMock.mockResolvedValue(poles);

    const jsx = await PolesPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Project" })).not.toBeInTheDocument();
  });

  describe("faults view (arriving via a 'Total faults' link)", () => {
    it("fetches poles for just that project, filters to isPoleFault === true, and excludes Unknown/stale (48h+) poles, for a Streetleaf Admin", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Streetleaf Admin",
        customerId: null,
      });
      getPolesMock.mockResolvedValue(projectPoles);
      getCustomerMock.mockResolvedValue(faultsCustomer);
      getProjectsForCustomerMock.mockResolvedValue(faultsProjects);

      const jsx = await PolesPage({
        searchParams: Promise.resolve({
          customerId: "rec5uaHZMOGZGyVcY",
          projectId: "proj-1",
          faults: "1",
        }),
      });
      render(jsx);

      expect(getPolesMock).toHaveBeenCalledWith({ projectId: "proj-1" }, "jwt-token");
      expect(screen.getByText("51079-2000")).toBeInTheDocument(); // isPoleFault: true, poleIssues: [], reporting
      expect(screen.queryByText("51079-2001")).not.toBeInTheDocument(); // isPoleFault: false, poleIssues: []
      expect(screen.queryByText("51079-2002")).not.toBeInTheDocument(); // isPoleFault: null, poleIssues: []
      expect(screen.queryByText("51079-2003")).not.toBeInTheDocument(); // faulted, but never reported (Unknown)
      expect(screen.queryByText("51079-2004")).not.toBeInTheDocument(); // faulted, but stale (72h)
    });

    it("scopes to the whole customer (every project) when projectId is omitted — the customer-level aggregate fault link", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Streetleaf Admin",
        customerId: null,
      });
      getPolesMock.mockResolvedValue(projectPoles);
      getCustomerMock.mockResolvedValue(faultsCustomer);
      getProjectsForCustomerMock.mockResolvedValue(faultsProjects);

      await PolesPage({
        searchParams: Promise.resolve({ customerId: "rec5uaHZMOGZGyVcY", faults: "1" }),
      });

      expect(getPolesMock).toHaveBeenCalledWith({ customerId: "rec5uaHZMOGZGyVcY" }, "jwt-token");
    });

    it("shows both Customer and Project columns, with the resolved names, for a Streetleaf Admin", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Streetleaf Admin",
        customerId: null,
      });
      getPolesMock.mockResolvedValue(projectPoles);
      getCustomerMock.mockResolvedValue(faultsCustomer);
      getProjectsForCustomerMock.mockResolvedValue(faultsProjects);

      const jsx = await PolesPage({
        searchParams: Promise.resolve({
          customerId: "rec5uaHZMOGZGyVcY",
          projectId: "proj-1",
          faults: "1",
        }),
      });
      render(jsx);

      expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Project" })).toBeInTheDocument();
      expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
      expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
    });

    it("shows only the Project column (no Customer) for a Customer Admin viewing their own customer's faults", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Customer Admin",
        customerId: "rec5uaHZMOGZGyVcY",
      });
      getPolesMock.mockResolvedValue(projectPoles);
      getCustomerMock.mockResolvedValue(faultsCustomer);
      getProjectsForCustomerMock.mockResolvedValue(faultsProjects);

      const jsx = await PolesPage({
        searchParams: Promise.resolve({
          customerId: "rec5uaHZMOGZGyVcY",
          projectId: "proj-1",
          faults: "1",
        }),
      });
      render(jsx);

      expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Project" })).toBeInTheDocument();
      expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
    });

    it("falls back to the normal customer-scoped view when a Customer Admin's URL points at a different customer (ignores the mismatched faults request)", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Customer Admin",
        customerId: "rec5uaHZMOGZGyVcY",
      });
      getPolesMock.mockResolvedValue(poles);

      const jsx = await PolesPage({
        searchParams: Promise.resolve({
          customerId: "some-other-customer",
          projectId: "proj-1",
          faults: "1",
        }),
      });
      render(jsx);

      // Falls through to the normal view: getPoles is called with the
      // viewer's OWN customerId, not the mismatched one from the URL, and
      // getCustomer/getProjectsForCustomer (faults-view-only) are never called.
      expect(getPolesMock).toHaveBeenCalledWith({ customerId: "rec5uaHZMOGZGyVcY" }, "jwt-token");
      expect(getCustomerMock).not.toHaveBeenCalled();
      expect(getProjectsForCustomerMock).not.toHaveBeenCalled();
      expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Project" })).not.toBeInTheDocument();
    });

    it("requires all three params (customerId, projectId, faults=1) — falls back to normal view if faults is missing", async () => {
      getSessionUserMock.mockResolvedValue({
        id: "u1",
        role: "Streetleaf Admin",
        customerId: null,
      });
      getPolesMock.mockResolvedValue(poles);

      const jsx = await PolesPage({
        searchParams: Promise.resolve({
          customerId: "rec5uaHZMOGZGyVcY",
          projectId: "proj-1",
        }),
      });
      render(jsx);

      expect(getPolesMock).toHaveBeenCalledWith(undefined, "jwt-token");
      expect(getCustomerMock).not.toHaveBeenCalled();
    });
  });
});
