/**
 * Appends a query param to a path if a value is present, otherwise returns the
 * path unchanged. Used to carry the customers search query through to detail
 * pages so links back (breadcrumbs, "back to Customers") restore the filter.
 */
export function withQueryParam(path: string, key: string, value?: string | null): string {
  if (!value) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

/**
 * Carries whichever search(es) led to the current page — a customers-list
 * search (cust_q) and/or a poles-list search (pole_q) — through to another
 * link, so navigating around doesn't lose that context.
 */
export function withSearchContext(
  path: string,
  custQ?: string | null,
  poleQ?: string | null,
): string {
  return withQueryParam(withQueryParam(path, "cust_q", custQ), "pole_q", poleQ);
}
