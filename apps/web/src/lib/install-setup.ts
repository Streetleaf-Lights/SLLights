import { isCrewProject } from "@sllights/shared/crew-access";
import { installSetupFrom, isGatewayPoleRegistered } from "@sllights/shared/install-options";
import type { Project } from "@sllights/shared/types";
import { getAllProjects, getPolesPage } from "@/lib/apim";

/** A project offered on the Install screen (active, with stickers), or null. */
export async function findInstallProject(projectId: string, token: string): Promise<Project | null> {
  const project = (await getAllProjects(token)).find((p) => p.id === projectId);
  return project && isCrewProject(project) ? project : null;
}

/**
 * The project's gateway poles (isGateway on /getPoles), in pole-number
 * order, and whether each already has its gateway registered (a gateway
 * group named after the pole).
 */
export async function gatewayPolesFor(project: Project, token: string): Promise<{ poleNumber: string; registered: boolean }[]> {
  const gateways = installSetupFrom(project.leadsunProject).gateways;
  // The paged call returns full pole records (with isGateway) — the full-list
  // call's summary may not. 1000 per page (APIM's cap); most projects fit one.
  const poles = [];
  for (let page = 1; ; page++) {
    const result = await getPolesPage({ page, pageSize: 1000, projectId: project.id }, token);
    poles.push(...result.items);
    if (result.items.length === 0 || poles.length >= result.total || page >= 50) break;
  }
  return poles
    .filter((pole) => pole.isGateway === true && pole.projectId === project.id)
    .map((pole) => ({ poleNumber: pole.poleNumber, registered: isGatewayPoleRegistered(pole.poleNumber, gateways) }))
    .sort((a, b) => a.poleNumber.localeCompare(b.poleNumber, undefined, { numeric: true }));
}
