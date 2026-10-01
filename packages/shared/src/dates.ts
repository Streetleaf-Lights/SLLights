/**
 * Parses the timestamp formats APIM returns into epoch milliseconds, or NaN
 * if it can't be parsed.
 *
 * APIM sends values like "2026-09-11 16:46:16.000 -04:00" — a space between
 * date and time (needs to become "T" for Date to parse it at all), *and*
 * another space between the fractional seconds and the offset, which Date's
 * parser rejects outright, silently producing an Invalid Date (NaN). A sort
 * comparator fed NaN never reorders anything, which is how this first
 * surfaced as pole issues silently staying in API order. Also handles the
 * no-space variant ("2026-07-26 13:25:41+00:00") and plain ISO strings.
 *
 * Always go through this rather than `Date.parse` / `new Date` directly on
 * an APIM value.
 */
export function parseApimDate(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const isoLike = value
    .trim()
    .replace(" ", "T")
    .replace(/\s+([+-]\d{2}:\d{2}|Z)$/, "$1");
  return new Date(isoLike).getTime();
}
