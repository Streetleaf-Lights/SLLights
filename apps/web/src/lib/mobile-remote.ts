import { NextResponse } from "next/server";
import { findLeadsunGroupForProduct, findLeadsunProduct } from "@sllights/shared/leadsun";
import type { LeadsunGroup, LeadsunProduct, LeadsunProject, SessionUser } from "@sllights/shared/types";
import { getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer } from "@/lib/mobile-views";

export type ResolvedPoleRemote =
  | { ok: true; leadsunProject: LeadsunProject | null; product: LeadsunProduct | undefined; group: LeadsunGroup | undefined }
  | { ok: false; response: NextResponse };

/**
 * Works out the one Leadsun lamp a mobile remote-control request may touch:
 * the caller must be able to see this customer (404 otherwise), the pole
 * must belong to this project (404 otherwise), and the lamp is the Leadsun
 * product matched to that pole's locationId — exactly the web pole page's
 * match. Nothing about the target comes from the request body.
 */
export async function resolvePoleRemote(
  session: SessionUser,
  token: string,
  customerId: string,
  projectId: string,
  poleId: string,
): Promise<ResolvedPoleRemote> {
  const notFound = { ok: false as const, response: NextResponse.json({ error: "Pole not found." }, { status: 404 }) };
  if (!canViewCustomer(session, customerId)) return notFound;

  const [projects, vitals] = await Promise.all([
    getProjectsForCustomer(customerId, token),
    getPoleVitalsForCustomer(customerId, token),
  ]);
  const project = projects.find((p) => p.id === projectId);
  const pole = vitals?.projects.find((p) => p.id === projectId)?.poles.find((p) => p.id === poleId);
  if (!project || !pole) return notFound;

  const product = findLeadsunProduct(project.leadsunProject, pole.locationId);
  return {
    ok: true,
    leadsunProject: project.leadsunProject,
    product,
    group: findLeadsunGroupForProduct(project.leadsunProject, product),
  };
}
