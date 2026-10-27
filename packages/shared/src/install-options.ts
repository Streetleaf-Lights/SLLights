import type { InstallOptionsResponse } from "./api-contract";
import type { LeadsunProject } from "./types";

export type InstallProjectOption = InstallOptionsResponse["projects"][number];

/** A submitted sticker's identity: its project and sticker number. */
export const stickerKey = (projectId: string, sticker: string) => `${projectId}::${sticker.trim().toUpperCase()}`;

/**
 * What the Install form still offers: each project's stickers minus those
 * already submitted from this phone (waiting to send or sent), and projects
 * with none left dropped — so the same pole can't be submitted twice.
 */
export function remainingInstallOptions(
  projects: readonly InstallProjectOption[],
  submitted: ReadonlySet<string>,
): InstallProjectOption[] {
  return projects
    .map((p) => ({ ...p, stickerNumbers: p.stickerNumbers.filter((s) => !submitted.has(stickerKey(p.id, s))) }))
    .filter((p) => p.stickerNumbers.length > 0);
}

/**
 * A project's setup for installs, done by the warehouse before field crews
 * can install: (1) a Leadsun project, then (2) at least one gateway (a
 * Leadsun group, identified by its GatewayCode).
 */
export interface InstallProjectSetup {
  leadsunProject: boolean;
  gateways: { code: string; name: string }[];
}

/** The setup described by a project's Leadsun data (null: not set up on Leadsun yet). */
export function installSetupFrom(leadsunProject: LeadsunProject | null | undefined): InstallProjectSetup {
  if (!leadsunProject?.ProjectId) return { leadsunProject: false, gateways: [] };
  return {
    leadsunProject: true,
    gateways: (leadsunProject.groups ?? [])
      .filter((g) => Boolean(g.GatewayCode?.trim()))
      .map((g) => ({ code: g.GatewayCode.trim(), name: g.GroupName?.trim() || g.GatewayCode.trim() })),
  };
}

export type InstallReadiness = "needsLeadsunProject" | "needsGateway" | "ready";

/**
 * Where a project is in its setup: field installs (the sticker-to-Submit
 * box) are only possible once it has a gateway. A project without setup
 * information (a list saved on the phone before this existed) counts as
 * ready, so an app update never blocks a crew who's out of signal.
 */
export function installReadiness(setup: InstallProjectSetup | undefined): InstallReadiness {
  if (!setup) return "ready";
  if (!setup.leadsunProject) return "needsLeadsunProject";
  return setup.gateways.length > 0 ? "ready" : "needsGateway";
}
