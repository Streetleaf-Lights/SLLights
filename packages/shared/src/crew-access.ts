/**
 * What a Streetleaf Crew login may see: the projects that have sticker
 * numbers issued (the projects crews install on), and the customers with at
 * least one such project. (This replaces the earlier per-project
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

/** Crew-visible projects, and the customers they belong to. */
export function crewScopeFrom(projects: readonly { id: string; customerId: string | null; stickerNumbers: readonly string[] }[]) {
  const visible = projects.filter(hasStickerNumbers);
  return {
    projectIds: new Set(visible.map((p) => p.id)),
    customerIds: new Set(visible.map((p) => p.customerId).filter((id): id is string => Boolean(id))),
  };
}
