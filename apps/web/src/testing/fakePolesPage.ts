import type { PoleSummary } from "@sllights/shared/types";
import type { PolesPageResult } from "@/lib/apim";

/**
 * A stand-in for APIM's paged /getPoles, built on a test's existing full-list
 * getPoles mock: it asks that mock for the same scope the old code did
 * (customerId, or nothing), then searches, sorts and pages like the API —
 * so tests written for the full list keep checking the same things.
 */
export function fakePolesPage(
  getPoles: (filters: { customerId?: string } | undefined, token?: string | null) => Promise<PoleSummary[]> | PoleSummary[],
) {
  return async (
    query: { page: number; pageSize: number; poleNumber?: string; customerId?: string },
    token?: string | null,
  ): Promise<PolesPageResult> => {
    const all = (await getPoles(query.customerId ? { customerId: query.customerId } : undefined, token)) ?? [];
    const q = query.poleNumber?.trim().toLowerCase() ?? "";
    const matching = all
      .filter((pole) => !q || pole.poleNumber.toLowerCase().includes(q))
      .sort((a, b) => a.poleNumber.localeCompare(b.poleNumber));
    const start = (query.page - 1) * query.pageSize;
    return { total: matching.length, page: query.page, pageSize: query.pageSize, items: matching.slice(start, start + query.pageSize) };
  };
}
