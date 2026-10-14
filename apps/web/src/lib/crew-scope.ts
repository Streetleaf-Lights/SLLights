import { crewScopeFrom, isCrew } from "@sllights/shared/crew-access";
import type { CustomerPoleVitals, SessionUser } from "@sllights/shared/types";
import { getAllProjects } from "@/lib/apim";

export type CrewScope = ReturnType<typeof crewScopeFrom>;

/**
 * A Streetleaf Crew login's projects (those with sticker numbers) and their
 * customers; null for any other role (their access is decided elsewhere).
 */
export async function crewScope(session: SessionUser, token: string): Promise<CrewScope | null> {
  if (!isCrew(session.role)) return null;
  return crewScopeFrom(await getAllProjects(token));
}

/**
 * For crew: may they see this customer (any of its projects has sticker
 * numbers) and, if given, this project (it has sticker numbers)? Always
 * true for other roles — callers still apply their own customer checks.
 */
export async function crewMaySee(
  session: SessionUser,
  token: string,
  customerId: string,
  projectId?: string,
): Promise<boolean> {
  const scope = await crewScope(session, token);
  if (!scope) return true;
  if (!scope.customerIds.has(customerId)) return false;
  return projectId === undefined || scope.projectIds.has(projectId);
}

/**
 * Customer vitals narrowed to some projects (for a crew's customer page):
 * just those projects, with totals added up over them — % working weighted
 * by each project's light count, as the mobile overview does.
 */
export function vitalsForProjects(
  vitals: CustomerPoleVitals | undefined,
  projectIds: ReadonlySet<string>,
): CustomerPoleVitals | undefined {
  if (!vitals) return vitals;
  const projects = vitals.projects.filter((p) => projectIds.has(p.id));
  const totalLights = projects.reduce((n, p) => n + p.totalLights, 0);
  return {
    ...vitals,
    projects,
    poles: projects.flatMap((p) => p.poles),
    totalLights,
    connectedLights: projects.reduce((n, p) => n + p.connectedLights, 0),
    totalFaults: projects.reduce((n, p) => n + p.totalFaults, 0),
    percentWorking: totalLights > 0 ? projects.reduce((n, p) => n + p.percentWorking * p.totalLights, 0) / totalLights : 0,
  };
}

/** A customer's project links narrowed to a crew's projects (the Customers table's nested list). */
export function customerForCrew<C extends { projects: { id: string }[] }>(customer: C, projectIds: ReadonlySet<string>): C {
  return { ...customer, projects: customer.projects.filter((p) => projectIds.has(p.id)) };
}
