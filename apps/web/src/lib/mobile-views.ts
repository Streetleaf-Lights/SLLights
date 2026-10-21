import {
  isOpenIssue,
  type CustomerOverviewResponse,
  type LightStats,
  type PoleDetailResponse,
  type ProjectDetailResponse,
} from "@sllights/shared/api-contract";
import { findLeadsunProduct, hasLeadsunProducts } from "@sllights/shared/leadsun";
import { buildPoleStatusCards, connectionStatusTone } from "@sllights/shared/pole-detail";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { formatFullAddress } from "@sllights/shared/format";
import type { Customer, CustomerPoleVitals, PoleVital, Project, ProjectVitals, SessionUser } from "@sllights/shared/types";

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
/**
 * Totals over some projects: lights, connected and faults added up; % working
 * averaged weighted by each project's light count. Null when none have data.
 */
export function sumLightStats(projects: (ProjectVitals | undefined)[]): LightStats {
  const withData = projects.filter((p): p is ProjectVitals => p !== undefined);
  if (withData.length === 0) return { totalLights: null, connectedLights: null, totalFaults: null, percentWorking: null };
  const totalLights = withData.reduce((n, p) => n + (p.totalLights ?? 0), 0);
  const weighted = withData.reduce((n, p) => n + (p.percentWorking ?? 0) * (p.totalLights ?? 0), 0);
  return {
    totalLights,
    connectedLights: withData.reduce((n, p) => n + (p.connectedLights ?? 0), 0),
    totalFaults: withData.reduce((n, p) => n + (p.totalFaults ?? 0), 0),
    percentWorking: totalLights > 0 ? weighted / totalLights : null,
  };
}

export function toCustomerOverview(
  customer: Customer,
  projects: Project[],
  vitals: CustomerPoleVitals | undefined,
  /** Streetleaf Crew: totals over the listed (sticker) projects only, not the whole customer. */
  { summaryOverListedProjects = false }: { summaryOverListedProjects?: boolean } = {},
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
    summary: summaryOverListedProjects
      ? sumLightStats(projects.map((p) => vitalsByProjectId.get(p.id)))
      : lightStats(vitals),
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
      lat: pole.lat,
      long: pole.long,
      connectedText: pole.connectedText,
      overallStatusText: pole.overallStatusText,
      lastUpdate: pole.lastUpdate,
      openIssues: (pole.poleIssues ?? []).filter(isOpenIssue).length,
    }));
  return {
    customer: { id: customer.id, name: customer.name },
    project: { id: project.id, name: project.name, active: project.active, ...lightStats(projectVitals) },
    poles,
    hasRemoteControl: hasLeadsunProducts(project.leadsunProject),
  };
}

/**
 * The web pole page's content for one pole, shaped for the viewer: status
 * cards from the same shared builder the web page uses, and the 48H overall
 * status only for staff. Raw telemetry fields aren't passed through, so a
 * customer-scoped viewer receives nothing the web wouldn't show them.
 */
export function toPoleDetail(
  customer: Customer,
  project: Project,
  pole: PoleVital,
  viewerScoped: boolean,
): PoleDetailResponse {
  return {
    customer: { id: customer.id, name: customer.name },
    project: { id: project.id, name: project.name, active: project.active },
    pole: {
      id: pole.id,
      poleNumber: pole.poleNumber,
      active: pole.active,
      lastUpdate: pole.lastUpdate,
      installDate: pole.installDate,
      lat: pole.lat,
      long: pole.long,
      connection: connectionStatusTone(pole.isOnline, pole.lastUpdate),
      // Staff only: customer-scoped viewers don't receive these at all.
      ...(viewerScoped ? {} : { overallStatusText: pole.overallStatusText, controllerId: pole.controllerId ?? null }),
      cards: buildPoleStatusCards(pole, viewerScoped),
      issues: pole.poleIssues ?? [],
      hasRemoteControl: findLeadsunProduct(project.leadsunProject, pole.locationId) !== undefined,
    },
  };
}
