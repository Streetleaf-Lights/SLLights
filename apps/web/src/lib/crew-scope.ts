import { crewScopeFrom, isCrew } from "@sllights/shared/crew-access";
import type { SessionUser } from "@sllights/shared/types";
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
