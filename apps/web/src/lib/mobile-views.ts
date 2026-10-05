import {
  isOpenIssue,
  type CustomerOverviewResponse,
  type LightStats,
  type ProjectDetailResponse,
} from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { formatFullAddress } from "@sllights/shared/format";
import type { Customer, CustomerPoleVitals, Project, ProjectVitals, SessionUser } from "@sllights/shared/types";

/**
 * Data scoping for the mobile monitoring routes — the same rule proxy.ts
 * applies to /customers/{id} on the web: a customer-scoped user may only
 * see their own customer; Streetleaf staff may see any.
 */
export function canViewCustomer(session: SessionUser, customerId: string): boolean {
  return !isCustomerScoped(session.role, session.customerId) || session.customerId === customerId;
}

function lightStats(vitals: ProjectVitals | undefined): LightStats {
  return {
    totalLights: vitals?.totalLights ?? null,
    connectedLights: vitals?.connectedLights ?? null,
    totalFaults: vitals?.totalFaults ?? null,
    percentWorking: vitals?.percentWorking ?? null,
  };
}

/** Mirrors the web's CustomerOverview: customer header, summary stats, project list in API order. */
export function toCustomerOverview(
  customer: Customer,
  projects: Project[],
  vitals: CustomerPoleVitals | undefined,
): CustomerOverviewResponse {
  const vitalsByProjectId = new Map(vitals?.projects.map((p) => [p.id, p]));
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      addressLine: formatFullAddress(customer),
      phone: customer.phone,
      active: customer.active,
    },
    summary: lightStats(vitals),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      active: project.active,
      ...lightStats(vitalsByProjectId.get(project.id)),
    })),
  };
}

const poleNumberOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Project header stats plus a trimmed, pole-number-sorted pole list. */
export function toProjectDetail(
  customer: Customer,
  project: Project,
  projectVitals: ProjectVitals | undefined,
): ProjectDetailResponse {
  const poles = [...(projectVitals?.poles ?? [])]
    .sort((a, b) => poleNumberOrder.compare(a.poleNumber, b.poleNumber))
    .map((pole) => ({
      id: pole.id,
      poleNumber: pole.poleNumber,
      connectedText: pole.connectedText,
      overallStatusText: pole.overallStatusText,
      lastUpdate: pole.lastUpdate,
      openIssues: (pole.poleIssues ?? []).filter(isOpenIssue).length,
    }));
  return {
    customer: { id: customer.id, name: customer.name },
    project: { id: project.id, name: project.name, active: project.active, ...lightStats(projectVitals) },
    poles,
  };
}
