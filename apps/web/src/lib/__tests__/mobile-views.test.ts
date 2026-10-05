import { describe, expect, it } from "vitest";
import { canViewCustomer, toCustomerOverview, toProjectDetail } from "@/lib/mobile-views";
import type { Customer, CustomerPoleVitals, PoleVital, Project, ProjectVitals } from "@/lib/types";

const customer = {
  id: "c1",
  name: "Coastal Power",
  projects: [],
  address: "1 Main St",
  city: "Tampa",
  state: "FL",
  zip: "33602",
  phone: "555-0100",
  active: true,
} as Customer;

const project = (id: string, name: string): Project => ({ id, name, leadsunProject: null, active: true });

const pole = (poleNumber: string, issues: string[] = []) =>
  ({
    id: `id-${poleNumber}`,
    poleNumber,
    connectedText: "Online",
    overallStatusText: "OK",
    lastUpdate: "2026-10-01 12:00:00+00:00",
    poleIssues: issues.map((status, i) => ({ issueId: `${poleNumber}-${i}`, status, poleStatus: "", dateReported: "", problemDetails: null })),
  }) as unknown as PoleVital;

const projectVitals = (id: string, poles: PoleVital[] = []): ProjectVitals => ({
  id,
  name: id,
  totalLights: 10,
  connectedLights: 9,
  totalFaults: 1,
  percentWorking: 90,
  poles,
});

describe("canViewCustomer", () => {
  it("lets customer-scoped users see only their own customer", () => {
    const session = { id: "u1", role: "Customer Admin", customerId: "c1" };
    expect(canViewCustomer(session, "c1")).toBe(true);
    expect(canViewCustomer(session, "c2")).toBe(false);
    expect(canViewCustomer({ id: "u2", role: "User", customerId: "c1" }, "c2")).toBe(false);
  });

  it("lets Streetleaf staff see any customer", () => {
    expect(canViewCustomer({ id: "a1", role: "Streetleaf Admin", customerId: null }, "c2")).toBe(true);
    expect(canViewCustomer({ id: "s1", role: "User", customerId: null }, "c2")).toBe(true);
  });
});

describe("toCustomerOverview", () => {
  it("builds the header, summary and per-project stats like the web overview", () => {
    const vitals = { ...projectVitals("all"), totalLights: 20, projects: [projectVitals("p1")] } as CustomerPoleVitals;
    const result = toCustomerOverview(customer, [project("p1", "North"), project("p2", "South")], vitals);

    expect(result.customer).toEqual({
      id: "c1",
      name: "Coastal Power",
      addressLine: "1 Main St, Tampa, FL 33602",
      phone: "555-0100",
      active: true,
    });
    expect(result.summary).toEqual({ totalLights: 20, connectedLights: 9, totalFaults: 1, percentWorking: 90 });
    expect(result.projects[0]).toMatchObject({ id: "p1", name: "North", totalLights: 10, totalFaults: 1 });
    // A project with no vitals shows nulls (rendered as "—"), not zeros.
    expect(result.projects[1]).toMatchObject({ id: "p2", totalLights: null, totalFaults: null });
  });

  it("handles a customer with no vitals at all", () => {
    expect(toCustomerOverview(customer, [], undefined).summary).toEqual({
      totalLights: null,
      connectedLights: null,
      totalFaults: null,
      percentWorking: null,
    });
  });
});

describe("toProjectDetail", () => {
  it("sorts poles numerically by pole number and counts only open issues", () => {
    const vitals = projectVitals("p1", [pole("PAS-10", ["Open", " open ", "Closed"]), pole("PAS-2"), pole("PAS-1")]);
    const result = toProjectDetail(customer, project("p1", "North"), vitals);

    expect(result.poles.map((p) => p.poleNumber)).toEqual(["PAS-1", "PAS-2", "PAS-10"]);
    expect(result.poles[2]).toEqual({
      id: "id-PAS-10",
      poleNumber: "PAS-10",
      connectedText: "Online",
      overallStatusText: "OK",
      lastUpdate: "2026-10-01 12:00:00+00:00",
      openIssues: 2,
    });
    expect(result.project).toMatchObject({ id: "p1", name: "North", totalLights: 10 });
    expect(result.customer).toEqual({ id: "c1", name: "Coastal Power" });
  });

  it("returns an empty pole list when the project has no vitals", () => {
    expect(toProjectDetail(customer, project("p1", "North"), undefined).poles).toEqual([]);
  });
});
