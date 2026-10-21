import type { PoleListRow } from "@sllights/shared/api-contract";
import { panelLabelText } from "@sllights/shared/format";
import type { PoleSummary } from "@sllights/shared/types";
import { decodeSessionToken } from "@sllights/shared/auth-role";
import { getPoles } from "@/lib/apim";

/**
 * A short-lived copy of getPoles PER PERSON, for the paged Poles lists (the
 * dashboard's and the app's). getPoles can't use Next's fetch cache (the
 * full staff list is ~9MB) and takes tens of seconds, so without this every
 * page turn or search would re-download it.
 *
 * Per person, never shared: APIM returns different poles to different users
 * (e.g. crews), so a list fetched with one person's token must never be
 * served to anyone else. Keyed by the token's user plus the scope ("all" or
 * a customer id). Requests whose token has no user aren't cached at all.
 *
 * Kept for POLES_CACHE_SECONDS (default 180 — the statuses describe the last
 * 48 hours, so a few minutes' delay is barely noticeable). At most
 * MAX_ENTRIES copies are held (each staff copy is several MB); the oldest
 * goes first.
 */
const MAX_ENTRIES = 30;
const cache = new Map<string, { at: number; poles: Promise<PoleSummary[]> }>();

function ttlMs() {
  const seconds = Number(process.env.POLES_CACHE_SECONDS ?? 180);
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 180) * 1000;
}

export function cachedPoles(scope: { customerId?: string }, token: string): Promise<PoleSummary[]> {
  const fetchPoles = () => getPoles(scope.customerId ? { customerId: scope.customerId } : undefined, token);
  const userId = decodeSessionToken(token)?.id;
  if (!userId) return fetchPoles();

  const key = `${userId}|${scope.customerId ? `customer:${scope.customerId}` : "all"}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs()) return hit.poles;

  // Drop expired copies, then the oldest ones if still at the limit.
  for (const [k, entry] of cache) if (now - entry.at >= ttlMs()) cache.delete(k);
  cache.delete(key);
  while (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);

  const poles = fetchPoles();
  cache.set(key, { at: now, poles });
  // Don't keep a failed fetch around for the whole TTL.
  poles.catch(() => {
    if (cache.get(key)?.poles === poles) cache.delete(key);
  });
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
