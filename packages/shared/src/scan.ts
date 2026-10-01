/**
 * Turns a raw barcode/QR payload into a pole number.
 *
 * ASSUMPTION — confirm against the real pole labels: a label encodes either
 *  - the pole number itself (e.g. "PAS-4938"), or
 *  - a URL carrying it as a `poleNumber` / `pole` query param, or as the
 *    last path segment (e.g. "https://…/poles/PAS-4938").
 * Pole numbers are normalized to uppercase and must be 2–40 characters of
 * letters, digits, and hyphens. Tighten POLE_NUMBER_PATTERN once the real
 * label format is known — a stricter pattern is the cheapest defence
 * against mis-scans (e.g. a crew member catching a product barcode on the
 * controller box instead of the pole tag).
 *
 * Deliberately avoids the URL global: React Native's URL implementation
 * doesn't fully support searchParams.
 */

export const POLE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,39}$/;

export type ParsePoleCodeResult =
  | { ok: true; poleNumber: string }
  | { ok: false; error: string };

const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const QUERY_KEYS = ["poleNumber", "pole"];

function fromUrl(raw: string): string | null {
  const [beforeHash] = raw.split("#");
  const [base, query = ""] = beforeHash.split("?");

  for (const pair of query.split("&")) {
    const [key, value = ""] = pair.split("=");
    if (QUERY_KEYS.includes(safeDecode(key)) && value) return safeDecode(value.replace(/\+/g, " "));
  }

  const path = base.replace(URL_PATTERN, "").split("/").slice(1).filter(Boolean);
  return path.length > 0 ? safeDecode(path[path.length - 1]) : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parsePoleCode(raw: string | null | undefined): ParsePoleCodeResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "The code was empty. Scan again or type the pole number." };

  const candidate = URL_PATTERN.test(trimmed) ? fromUrl(trimmed) : trimmed;
  const poleNumber = (candidate ?? "").trim().toUpperCase();

  if (!POLE_NUMBER_PATTERN.test(poleNumber)) {
    return {
      ok: false,
      error: "That code doesn't look like a pole number. Check you scanned the pole tag.",
    };
  }
  return { ok: true, poleNumber };
}
