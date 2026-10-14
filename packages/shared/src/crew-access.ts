/**
 * What a Streetleaf Crew login may see: the active projects that have
 * sticker numbers issued (the projects crews install on), and the customers
 * with at least one such project. (This replaces the earlier per-project
 * CrewAssigned flag.) Enforced on the server; the app simply shows what the
 * server returns.
 */
export const CREW_ROLE = "Streetleaf Crew";

export function isCrew(role: string | null | undefined): boolean {
  return role === CREW_ROLE;
}

export function hasStickerNumbers(project: { stickerNumbers?: readonly string[] | null }): boolean {
  return (project.stickerNumbers ?? []).some((n) => n.trim().length > 0);
}

/** A project crews work on: active, with sticker numbers issued. */
export function isCrewProject(project: { active: boolean; stickerNumbers?: readonly string[] | null }): boolean {
  return project.active && hasStickerNumbers(project);
}

/** Crew-visible projects (active, with sticker numbers), and the customers they belong to. */
export function crewScopeFrom(
  projects: readonly { id: string; customerId: string | null; active: boolean; stickerNumbers: readonly string[] }[],
) {
  const visible = projects.filter(isCrewProject);
  return {
    projectIds: new Set(visible.map((p) => p.id)),
    customerIds: new Set(visible.map((p) => p.customerId).filter((id): id is string => Boolean(id))),
  };
}
