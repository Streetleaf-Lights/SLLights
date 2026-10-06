/** Same page size as the web's customer and pole tables. */
export const DEFAULT_PAGE_SIZE = 10;

export interface Page<T> {
  items: T[];
  /** Clamped to 1..totalPages, so a stale page number after filtering still shows real rows. */
  page: number;
  totalPages: number;
  totalItems: number;
  /** 1-based positions of the first and last item shown; both 0 when there are none. */
  firstItem: number;
  lastItem: number;
}

/** Slices `items` into the requested page — the logic behind the web's CustomersTable paging. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE): Page<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    items: pageItems,
    page: current,
    totalPages,
    totalItems,
    firstItem: pageItems.length ? start + 1 : 0,
    lastItem: start + pageItems.length,
  };
}

/**
 * The run of page numbers to show around the current page: `size` pages,
 * centred on `current` where possible and shifted at either end. The web
 * shows 5; the mobile pager shows 3. Callers add a leading "…" when the
 * window doesn't start at 1, and a trailing one when it doesn't end at `total`.
 */
export function getPageWindow(current: number, total: number, size = 5): number[] {
  let start = Math.max(1, current - Math.floor(size / 2));
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

export type PagerItem = { kind: "page"; page: number } | { kind: "gap"; key: "leading" | "trailing" };

export interface PagerLayout {
  /** Page 1, shown outside the Previous arrow — null when the window already includes it. */
  first: number | null;
  /** Between the arrows: the window around the current page, with "…" only where pages are skipped. */
  middle: PagerItem[];
  /** The last page, shown outside the Next arrow — null when the window already includes it. */
  last: number | null;
}

/**
 * The mobile pager row, laid out like the web's (First, Previous, pages,
 * Next, Last): the first and last page sit outside the arrows and appear
 * only when the window doesn't already include them; an ellipsis marks
 * skipped pages but never sits between neighbours (no "1 ‹ … 2").
 *
 *   page 1 of 9 →    ‹ 1 2 3 … › 9
 *   page 3 of 9 →  1 ‹ 2 3 4 … › 9
 *   page 5 of 9 →  1 ‹ … 4 5 6 … › 9
 *   page 9 of 9 →  1 ‹ … 7 8 9 ›
 */
export function getPagerLayout(current: number, total: number, windowSize = 3): PagerLayout {
  if (total <= 1) return { first: null, middle: [], last: null };
  const window = getPageWindow(current, total, windowSize);
  const start = window[0];
  const end = window[window.length - 1];
  const middle: PagerItem[] = [];

  if (start > 2) middle.push({ kind: "gap", key: "leading" });
  for (const page of window) middle.push({ kind: "page", page });
  if (end < total - 1) middle.push({ kind: "gap", key: "trailing" });

  return { first: start > 1 ? 1 : null, middle, last: end < total ? total : null };
}
