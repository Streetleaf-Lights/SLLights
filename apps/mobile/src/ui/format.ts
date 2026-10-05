import { formatPercent } from "@sllights/shared/format";

/** Counts as the web shows them: a number, or "—" when APIM had no vitals. */
export const count = (value: number | null) => (value === null ? "—" : String(value));
export const percent = (value: number | null) => formatPercent(value);
