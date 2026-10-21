import type { PoleSummary } from "@sllights/shared/types";
import { getPolesPage } from "@/lib/apim";

export const POLES_PAGE_SIZE = 10;

export interface PolesPage {
  /** This page's poles only (what's sent to the browser). */
  rows: PoleSummary[];
  /** Poles matching the search. */
  total: number;
  /** Poles before searching (tells "none on file" from "no match"). */
  unfilteredTotal: number;
  /** The page shown (clamped to 1…totalPages). */
  page: number;
  totalPages: number;
}

/**
 * One page of the Poles list, filtered by pole number on the server, so the
 * browser gets 10 rows instead of the whole list (~14,000 for staff).
 * `page` comes from the URL, so anything odd (missing, 0, "abc") becomes 1
 * and anything past the end becomes the last page.
 */
export function pagePoles(poles: readonly PoleSummary[], query: string | undefined, page: string | number | undefined): PolesPage {
  const q = (query ?? "").trim().toLowerCase();
  const matching = q ? poles.filter((pole) => pole.poleNumber.toLowerCase().includes(q)) : poles;
  const totalPages = Math.max(1, Math.ceil(matching.length / POLES_PAGE_SIZE));
  const requested = Math.floor(Number(page));
  const current = Number.isFinite(requested) && requested >= 1 ? Math.min(requested, totalPages) : 1;
  return {
    rows: matching.slice((current - 1) * POLES_PAGE_SIZE, current * POLES_PAGE_SIZE),
    total: matching.length,
    unfilteredTotal: poles.length,
    page: current,
    totalPages,
  };
}

/**
 * One page of poles straight from APIM's paged /getPoles — no full-list
 * download. A page past the end (e.g. an old link) shows the last page
 * instead. Returns the same shape as pagePoles, so callers don't care which
 * source answered. `unfilteredTotal` isn't known when searching; a search
 * with no matches reports it as non-zero so the list says "no matches"
 * rather than "no poles on file".
 */
export async function pagePolesFromApi(
  query: { page: string | number | undefined; poleNumber?: string; customerId?: string },
  token: string,
): Promise<PolesPage> {
  const searching = Boolean(query.poleNumber?.trim());
  const requested = Math.floor(Number(query.page));
  const page = Number.isFinite(requested) && requested >= 1 ? requested : 1;
  const ask = (p: number) =>
    getPolesPage({ page: p, pageSize: POLES_PAGE_SIZE, poleNumber: query.poleNumber, customerId: query.customerId }, token);

  let result = await ask(page);
  const totalPages = Math.max(1, Math.ceil(result.total / POLES_PAGE_SIZE));
  if (result.items.length === 0 && result.total > 0 && page > totalPages) result = await ask(totalPages);

  return {
    rows: result.items.slice(0, POLES_PAGE_SIZE),
    total: result.total,
    unfilteredTotal: searching ? Math.max(result.total, 1) : result.total,
    page: Math.min(page, totalPages),
    totalPages,
  };
}
