import type { LeadsunGroup, LeadsunLampStatus, LeadsunProduct, LeadsunProject } from "@/lib/types";

/** True if this project has at least one Leadsun product configured, in any group. */
export function hasLeadsunProducts(leadsunProject: LeadsunProject | null | undefined): boolean {
  return Boolean(
    leadsunProject?.groups?.some((group) => (group.products?.length ?? 0) > 0),
  );
}

/**
 * Finds the Leadsun product matching a pole's locationId — ProductName is
 * the field that lines up with our locationId (confirmed against sample
 * data) — searched across every group in the project, since a pole's
 * group isn't otherwise known to us.
 */
export function findLeadsunProduct(
  leadsunProject: LeadsunProject | null | undefined,
  locationId: string | null | undefined,
): LeadsunProduct | undefined {
  if (!leadsunProject?.groups || !locationId) return undefined;
  for (const group of leadsunProject.groups) {
    const match = group.products?.find((product) => product.ProductName === locationId);
    if (match) return match;
  }
  return undefined;
}

/**
 * Finds the gateway (group) a given product belongs to — e.g. so a
 * single-pole view can show that pole's own gateway name, matched by
 * ProductId (unique within a project, unlike ProductName which is a
 * separate identifier already used for the locationId match above).
 */
export function findLeadsunGroupForProduct(
  leadsunProject: LeadsunProject | null | undefined,
  product: Pick<LeadsunProduct, "ProductId"> | null | undefined,
): LeadsunGroup | undefined {
  if (!leadsunProject?.groups || !product) return undefined;
  return leadsunProject.groups.find((group) =>
    group.products?.some((candidate) => candidate.ProductId === product.ProductId),
  );
}

/** A lamp is ON if either channel is drawing any power at all — OFF (both 0) otherwise. */
export function isLampOn(lamp: Pick<LeadsunLampStatus, "lampPower1" | "lampPower2">): boolean {
  return lamp.lampPower1 + lamp.lampPower2 > 0;
}
