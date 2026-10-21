import type { PoleSummary } from "@sllights/shared/types";

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
