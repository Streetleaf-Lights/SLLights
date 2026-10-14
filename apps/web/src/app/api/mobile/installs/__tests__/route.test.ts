import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { allProjects, users } = vi.hoisted(() => ({ allProjects: vi.fn(), users: vi.fn() }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getAllProjects: allProjects, getUsers: users };
});

import { POST } from "@/app/api/mobile/installs/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const crew = testToken({ sub: "crew1", role: "Streetleaf Crew", exp });

const install = {
  id: "uuid-1",
  projectId: "p1",
  lightHeadSerial: "RHEA000025111652",
  solarPanelSerial: "AEXSAM3325111132",
  poleNumber: "TESTSL1-1001",
  latitude: 28.196376054573985,
  longitude: -82.26689041599842,
  accuracyMeters: 5,
  capturedAt: "2026-10-14T14:44:33.000Z",
  notes: "Testing mobile app scanning",
};
const AIRTABLE = "https://api.airtable.com/v0/appUgSvE28S6C0Yua/tblzmpWUp9fvbp0Ri";

/** A fake Airtable: answers the duplicate lookup and the create. */
let existing: { id: string; fields: Record<string, string> }[] = [];
let createStatus = 200;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === "GET") return new Response(JSON.stringify({ records: existing }), { status: 200 });
  if (createStatus !== 200) return new Response(JSON.stringify({ error: { type: "X", message: `failed ${createStatus}` } }), { status: createStatus });
  return new Response(JSON.stringify({ records: [{ id: "recNEW", fields: JSON.parse(String(init?.body)).records[0].fields }] }), { status: 200 });
});

beforeEach(() => {
  existing = [];
  createStatus = 200;
  vi.stubEnv("AIRTABLE_TOKEN", "pat-secret");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  users.mockResolvedValue([{ id: "crew1", name: "Casey Crew", email: "casey@streetleaf.com", role: "Streetleaf Crew" }]);
  allProjects.mockResolvedValue([
    { id: "p1", name: "Babcock", customerId: "c1", active: true, stickerNumbers: ["TESTSL1-1001", "TESTSL1-1002"], leadsunProject: null },
    { id: "p2", name: "Old", customerId: "c1", active: false, stickerNumbers: ["OLD-1"], leadsunProject: null },
  ]);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockClear();
  allProjects.mockReset();
  users.mockReset();
});

const post = (body: unknown, token: string | null = crew) =>
  POST(
    new NextRequest("http://localhost/api/mobile/installs", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const creates = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

describe("POST /api/mobile/installs", () => {
  it("records the install in Airtable exactly as the table expects", async () => {
    const res = await post(install);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, recordId: "recNEW", alreadyRecorded: false });
    const [url, init] = creates()[0];
    expect(url).toBe(AIRTABLE);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer pat-secret");
    expect(JSON.parse(String(init?.body))).toEqual({
      records: [
        {
          fields: {
            "Pole Number": "TESTSL1-1001",
            "Solar Panel Serial": "AEXSAM3325111132",
            "Lighthead Serial": "RHEA000025111652",
            "Location Coordinates ": "Longitude: -82.26689041599842 Latitude: 28.196376054573985",
            Notes: "Testing mobile app scanning",
            "Installed By": "casey@streetleaf.com",
            "Captured At": "2026-10-14T14:44:33.000Z",
            "Install ID": "uuid-1",
          },
        },
      ],
    });
  });

  it("takes Installed By from the signed-in user on the server, never from the request", async () => {
    await post({ ...install, installedBy: "someone-else@example.com", "Installed By": "spoofed" });
    const fields = JSON.parse(String(creates()[0][1]?.body)).records[0].fields;
    expect(fields["Installed By"]).toBe("casey@streetleaf.com");
  });

  it("records Captured At as when the crew submitted on the phone, not when it arrived", async () => {
    await post({ ...install, capturedAt: "2026-10-13T08:15:00.000Z" }); // captured yesterday, offline
    expect(JSON.parse(String(creates()[0][1]?.body)).records[0].fields["Captured At"]).toBe("2026-10-13T08:15:00.000Z");
  });

  it("falls back to the user id if the user isn't in the list, rather than blocking the install", async () => {
    users.mockResolvedValue([]);
    expect((await post(install)).status).toBe(200);
    expect(JSON.parse(String(creates()[0][1]?.body)).records[0].fields["Installed By"]).toBe("user crew1");
  });

  it("recognises a resend by its Install ID, even if the serials were since corrected", async () => {
    existing = [{ id: "recOLD", fields: { "Pole Number": "TESTSL1-1001", "Solar Panel Serial": "TYPO", "Lighthead Serial": "RHEA000025111652", "Install ID": "uuid-1" } }];
    const res = await post(install);
    expect(await res.json()).toEqual({ success: true, recordId: "recOLD", alreadyRecorded: true });
    expect(creates()).toHaveLength(0);
  });

  it("leaves Notes out when there are none", async () => {
    await post({ ...install, notes: null });
    expect(JSON.parse(String(creates()[0][1]?.body)).records[0].fields).not.toHaveProperty("Notes");
  });

  it("looks up the pole first, safely quoting it in the formula", async () => {
    await post({ ...install, poleNumber: "TESTSL1-1001" });
    const lookup = new URL(String(fetchMock.mock.calls[0][0]));
    expect(lookup.searchParams.get("filterByFormula")).toBe("{Pole Number}='TESTSL1-1001'");
    expect(lookup.searchParams.get("maxRecords")).toBe("1");
  });

  it("treats the same install sent again (a lost reply) as done, without a second record", async () => {
    existing = [{ id: "recOLD", fields: { "Pole Number": "TESTSL1-1001", "Solar Panel Serial": "AEXSAM3325111132", "Lighthead Serial": "RHEA000025111652" } }];
    const res = await post(install);
    expect(await res.json()).toEqual({ success: true, recordId: "recOLD", alreadyRecorded: true });
    expect(creates()).toHaveLength(0);
  });

  it("refuses a different install for a pole that's already recorded (two crews, one pole)", async () => {
    existing = [{ id: "recOTHER", fields: { "Pole Number": "TESTSL1-1001", "Solar Panel Serial": "SOMETHING-ELSE", "Lighthead Serial": "RHEA000025111652" } }];
    const res = await post(install);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already has an install recorded/);
    expect(creates()).toHaveLength(0);
  });

  it.each([
    ["a sticker that isn't the project's", { ...install, poleNumber: "OTHER-9" }],
    ["an inactive project", { ...install, projectId: "p2", poleNumber: "OLD-1" }],
    ["an unknown project", { ...install, projectId: "nope" }],
  ])("refuses %s (422), without touching Airtable", async (_l, body) => {
    expect((await post(body)).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s an incomplete install", async () => {
    expect((await post({ ...install, solarPanelSerial: "" })).status).toBe(400);
    expect((await post("{nope")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is only for the roles with the Install tab", async () => {
    const owner = testToken({ sub: "o", role: "Customer Owner", customerId: "c1", exp });
    expect((await post(install, owner)).status).toBe(403);
    expect((await post(install, null)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [429, 429],
    [500, 503],
    [401, 503], // a bad token is a server problem: keep the install and retry later
    [422, 422], // Airtable refused the record itself
  ])("maps Airtable %i to %i", async (airtableStatus, expected) => {
    createStatus = airtableStatus;
    expect((await post(install)).status).toBe(expected);
  });

  it("keeps the install for later (503) when Airtable can't be reached or isn't configured — without leaking details", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await post(install)).status).toBe(503);
    vi.stubEnv("AIRTABLE_TOKEN", "");
    const res = await post(install);
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/AIRTABLE_TOKEN|pat-/);
  });
});
