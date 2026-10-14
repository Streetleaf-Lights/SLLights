import type { InstallSubmission } from "@sllights/shared/install-submission";

/**
 * Field installs in Airtable (the Installs table). Server-side only: the
 * token can write to the base, so it never goes to the phone.
 *
 * AIRTABLE_TOKEN                — a personal access token with
 *                                 data.records:read and data.records:write
 *                                 on this base (required)
 * AIRTABLE_INSTALLS_BASE_ID     — default appUgSvE28S6C0Yua
 * AIRTABLE_INSTALLS_TABLE_ID    — default tblzmpWUp9fvbp0Ri
 */
const DEFAULT_BASE_ID = "appUgSvE28S6C0Yua";
const DEFAULT_TABLE_ID = "tblzmpWUp9fvbp0Ri";

/** Airtable field names, exactly as in the base — note the trailing space on "Location Coordinates ". */
export const INSTALL_FIELDS = {
  poleNumber: "Pole Number",
  solarPanelSerial: "Solar Panel Serial",
  lightHeadSerial: "Lighthead Serial",
  location: "Location Coordinates ",
  notes: "Notes",
} as const;

export class AirtableError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

function config() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!token) throw new AirtableError("Airtable isn't configured (AIRTABLE_TOKEN).", 500);
  const base = process.env.AIRTABLE_INSTALLS_BASE_ID?.trim() || DEFAULT_BASE_ID;
  const table = process.env.AIRTABLE_INSTALLS_TABLE_ID?.trim() || DEFAULT_TABLE_ID;
  return { token, url: `https://api.airtable.com/v0/${base}/${table}` };
}

/** The coordinates as the table records them: "Longitude: <long> Latitude: <lat>". */
export const formatInstallLocation = (latitude: number, longitude: number) => `Longitude: ${longitude} Latitude: ${latitude}`;

/** The Airtable fields for an install (Notes left out when empty). */
export function installFields(install: InstallSubmission): Record<string, string> {
  return {
    [INSTALL_FIELDS.poleNumber]: install.poleNumber,
    [INSTALL_FIELDS.solarPanelSerial]: install.solarPanelSerial,
    [INSTALL_FIELDS.lightHeadSerial]: install.lightHeadSerial,
    [INSTALL_FIELDS.location]: formatInstallLocation(install.latitude, install.longitude),
    ...(install.notes ? { [INSTALL_FIELDS.notes]: install.notes } : {}),
  };
}

/** A value inside an Airtable formula string literal. */
const formulaString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function airtable(path: string, init: RequestInit = {}) {
  const { token, url } = config();
  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new AirtableError("Couldn't reach Airtable.", 502);
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const error = body?.error as { message?: string; type?: string } | string | undefined;
    const message = typeof error === "string" ? error : error?.message || error?.type || `Airtable request failed (${res.status}).`;
    throw new AirtableError(message, res.status);
  }
  return body ?? {};
}

export interface InstallRecord {
  id: string;
  poleNumber: string;
  solarPanelSerial: string | null;
  lightHeadSerial: string | null;
}

/** The install already recorded for a pole, if any. */
export async function findInstallByPole(poleNumber: string): Promise<InstallRecord | null> {
  const params = new URLSearchParams({
    filterByFormula: `{${INSTALL_FIELDS.poleNumber}}=${formulaString(poleNumber)}`,
    maxRecords: "1",
  });
  for (const f of [INSTALL_FIELDS.poleNumber, INSTALL_FIELDS.solarPanelSerial, INSTALL_FIELDS.lightHeadSerial]) {
    params.append("fields[]", f);
  }
  const body = await airtable(`?${params.toString()}`, { method: "GET" });
  const record = (body.records as { id: string; fields: Record<string, unknown> }[] | undefined)?.[0];
  if (!record) return null;
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    id: record.id,
    poleNumber: text(record.fields[INSTALL_FIELDS.poleNumber]) ?? poleNumber,
    solarPanelSerial: text(record.fields[INSTALL_FIELDS.solarPanelSerial]),
    lightHeadSerial: text(record.fields[INSTALL_FIELDS.lightHeadSerial]),
  };
}

/** Records an install; returns the new Airtable record id. */
export async function createInstall(install: InstallSubmission): Promise<string> {
  const body = await airtable("", {
    method: "POST",
    body: JSON.stringify({ records: [{ fields: installFields(install) }] }),
  });
  const id = (body.records as { id: string }[] | undefined)?.[0]?.id;
  if (!id) throw new AirtableError("Airtable didn't return the new record.", 502);
  return id;
}
