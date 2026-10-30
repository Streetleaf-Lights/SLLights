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
  /** The registered gateways (Leadsun groups); groupId is Leadsun's GroupId. */
  gateways: { code: string; name: string; groupId?: number | null }[];
}

/** The setup described by a project's Leadsun data (null: not set up on Leadsun yet). */
export function installSetupFrom(leadsunProject: LeadsunProject | null | undefined): InstallProjectSetup {
  if (!leadsunProject?.ProjectId) return { leadsunProject: false, gateways: [] };
  return {
    leadsunProject: true,
    gateways: (leadsunProject.groups ?? [])
      .filter((g) => Boolean(g.GatewayCode?.trim()))
      .map((g) => ({
        code: g.GatewayCode.trim(),
        name: g.GroupName?.trim() || g.GatewayCode.trim(),
        groupId: typeof g.GroupId === "number" ? g.GroupId : null,
      })),
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

/**
 * A gateway's Leadsun group name: the gateway pole's number, then the
 * project's name — "TESTSL1-1001 Spine Road".
 */
export function gatewayGroupName(poleNumber: string, projectName: string): string {
  return `${poleNumber.trim()} ${projectName.trim()}`;
}

/**
 * Whether a gateway pole already has its gateway registered: a gateway whose
 * group name is that pole number (followed by the project name, or alone).
 */
export function isGatewayPoleRegistered(poleNumber: string, gateways: readonly { name: string }[]): boolean {
  const pole = poleNumber.trim().toUpperCase();
  return gateways.some((g) => {
    const name = g.name.trim().toUpperCase();
    return name === pole || name.startsWith(`${pole} `);
  });
}

/** The longest gateway serial number accepted (a guard against junk, not a format rule). */
export const GATEWAY_SERIAL_MAX_LENGTH = 64;
