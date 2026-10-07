import type { PoleListRow } from "@sllights/shared/api-contract";
import { panelLabelText } from "@sllights/shared/format";
import type { PoleSummary } from "@sllights/shared/types";
import { getPoles } from "@/lib/apim";

/**
 * A short-lived, per-scope copy of getPoles for the paged mobile Poles list.
 * getPoles bypasses APIM caching, and for Streetleaf staff the full list is
 * large (~9MB); without this, every page turn or search keystroke would
 * re-download it. Keyed by scope ("all", or one customer id) — callers
 * check the viewer may see a scope before asking for it, so a cached list
 * is never served across customers. Same freshness as the app's other
 * APIM reads (APIM_CACHE_SECONDS, default 30).
 */
const cache = new Map<string, { at: number; poles: Promise<PoleSummary[]> }>();

export function cachedPoles(scope: { customerId?: string }, token: string): Promise<PoleSummary[]> {
  const ttlMs = Number(process.env.APIM_CACHE_SECONDS ?? 30) * 1000;
  const key = scope.customerId ? `customer:${scope.customerId}` : "all";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.poles;
  const poles = getPoles(scope.customerId ? { customerId: scope.customerId } : undefined, token);
  cache.set(key, { at: Date.now(), poles });
  // Don't keep a failed fetch around for the whole TTL.
  poles.catch(() => cache.delete(key));
  return poles;
}

/** For tests. */
export function clearPolesCache() {
  cache.clear();
}

/** A row as the web's PolesTable shows it to this viewer (no "48h Connected" for customer-scoped). */
export function toPoleListRow(pole: PoleSummary, viewerScoped: boolean, projectName?: string | null): PoleListRow {
  return {
    id: pole.id,
    poleNumber: pole.poleNumber,
    customerId: pole.customerId,
    projectId: pole.projectId,
    isOnline: pole.isOnline,
    ...(viewerScoped ? {} : { connectedText: pole.connectedText }),
    overallStatusText: pole.overallStatusText,
    lightStatusText: pole.lightStatusText,
    panelText: panelLabelText(pole),
    batteryStatusText: pole.batteryStatusText,
    ...(projectName !== undefined ? { projectName } : {}),
  };
}
