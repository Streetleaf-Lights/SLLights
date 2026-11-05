import type { InstallOptionsResponse } from "./api-contract";
import type { LeadsunProject, ProjectGatewayPlan } from "./types";

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
 * Whether a gateway pole already has its gateway registered: a registered
 * gateway (Leadsun group) whose name contains that pole number as a word —
 * the planned name ("Test Gateway TESTSL1-1001") or the older
 * "<pole> <project>" format.
 */
export function isGatewayPoleRegistered(poleNumber: string, gateways: readonly { name: string }[]): boolean {
  return gateways.some((g) => nameHasPole(g.name, poleNumber));
}

/**
 * Whether a gateway (group) name contains the pole number as a whole word:
 * "Test Gateway TESTSL1-1001" and "TESTSL1-1001 Spine Road" both name
 * TESTSL1-1001, but neither names TESTSL1-100.
 */
function nameHasPole(name: string, poleNumber: string): boolean {
  const pole = poleNumber.trim().toUpperCase();
  return Boolean(pole) && name.trim().toUpperCase().split(/\s+/).includes(pole);
}

/** The longest gateway serial number accepted (a guard against junk, not a format rule). */
export const GATEWAY_SERIAL_MAX_LENGTH = 64;

/** The planned gateways from a project's `gateways` field (a JSON string or a list), skipping malformed entries. */
export function parseGatewayPlans(raw: unknown): ProjectGatewayPlan[] {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const name = text(e.Name);
    const poleNumber = text(e.PoleNumber);
    if (!name || !poleNumber) return [];
    const connected = Array.isArray(e.ConnectedPoles) ? e.ConnectedPoles.map(text).filter(Boolean) : [];
    return [{ name, poleNumber, controllerId: text(e.ControllerId) || null, connectedPoles: connected }];
  });
}

/** The planned gateway for a gateway pole, if the project names one. */
export function gatewayPlanForPole(poleNumber: string, plans: readonly ProjectGatewayPlan[]): ProjectGatewayPlan | null {
  const pole = poleNumber.trim().toUpperCase();
  return plans.find((p) => p.poleNumber.toUpperCase() === pole) ?? null;
}

/**
 * The poles to install for a registered gateway (Step 3): its planned
 * gateway's ConnectedPoles — matched by name, or else by the gateway pole
 * named in it. Null when no planned gateway matches.
 */
export function connectedPolesFor(
  gateway: { name: string },
  plans: readonly Pick<ProjectGatewayPlan, "name" | "poleNumber" | "connectedPoles">[],
): string[] | null {
  const byName = plans.find((p) => p.name.trim().toUpperCase() === gateway.name.trim().toUpperCase());
  const plan = byName ?? plans.find((p) => nameHasPole(gateway.name, p.poleNumber));
  return plan ? plan.connectedPoles : null;
}
