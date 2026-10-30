import { describe, expect, it } from "vitest";
import { validateInstallDraft, type InstallDraft } from "../install-submission";

const GATEWAY = { code: "GT12L94A24072662", name: "TESTSL1-1001 Spine Road", groupId: 1890 };
const draft = (extra: Partial<InstallDraft> = {}): InstallDraft => ({
  projectId: "p1",
  gateway: GATEWAY,
  lightHeadSerial: "  LH-001 ",
  solarPanelSerial: " SP-002 ",
  poleNumber: " pas-12 ",
  location: { latitude: 27.95, longitude: -82.46, accuracyMeters: 5 },
  notes: "  ",
  ...extra,
});

describe("validateInstallDraft (everything required except Notes)", () => {
  it("accepts a complete install, trimming serials, upper-casing the pole number; blank notes become null", () => {
    expect(validateInstallDraft(draft())).toEqual({
      ok: true,
      value: {
        projectId: "p1",
        gateway: GATEWAY,
        lightHeadSerial: "LH-001",
        solarPanelSerial: "SP-002",
        poleNumber: "PAS-12",
        latitude: 27.95,
        longitude: -82.46,
        accuracyMeters: 5,
        notes: null,
      },
    });
  });

  it("keeps notes when given", () => {
    expect(validateInstallDraft(draft({ notes: " New base " }))).toMatchObject({ ok: true, value: { notes: "New base" } });
  });

  it("requires both serials, the pole number and a location", () => {
    expect(validateInstallDraft(draft({ projectId: "", lightHeadSerial: " ", solarPanelSerial: "", poleNumber: "  ", location: null }))).toEqual({
      ok: false,
      errors: {
        projectId: "Select a project.",
        lightHeadSerial: "Light Head Serial Number is required.",
        solarPanelSerial: "Solar Panel Serial Number is required.",
        poleNumber: "Select a sticker (pole number).",
        location: "Location is required. Get the location before submitting.",
      },
    });
  });

  it.each([
    ["missing light head serial", { lightHeadSerial: "" }, "lightHeadSerial"],
    ["missing solar panel serial", { solarPanelSerial: "  " }, "solarPanelSerial"],
    ["missing pole number (sticker)", { poleNumber: "" }, "poleNumber"],
    ["missing project", { projectId: "" }, "projectId"],
    ["no location", { location: null }, "location"],
    ["unusable location", { location: { latitude: 200, longitude: 1, accuracyMeters: null } }, "location"],
  ])("rejects %s", (_l, extra, field) => {
    const r = validateInstallDraft(draft(extra as Partial<InstallDraft>));
    expect(r.ok).toBe(false);
    expect(Object.keys((r as { errors: object }).errors)).toEqual([field]);
  });

  it("doesn't require notes, but limits their length and the serials'", () => {
    expect(validateInstallDraft(draft({ notes: "" })).ok).toBe(true);
    const r = validateInstallDraft(draft({ lightHeadSerial: "X".repeat(65), notes: "n".repeat(501) }));
    expect(r).toMatchObject({ ok: false, errors: { lightHeadSerial: expect.any(String), notes: expect.any(String) } });
  });
});

import { validateInstallSubmission } from "../install-submission";

describe("validateInstallSubmission (server side)", () => {
  const good = {
    id: "uuid-1",
    projectId: "p1",
    gateway: GATEWAY,
    lightHeadSerial: " RHEA000025111652 ",
    solarPanelSerial: "AEXSAM3325111132",
    poleNumber: "testsl1-1001",
    latitude: 28.196376054573985,
    longitude: -82.26689041599842,
    accuracyMeters: 5,
    capturedAt: "2026-10-14T14:44:33.000Z",
    notes: "Testing mobile app scanning",
  };

  it("accepts a complete install, cleaned like the form", () => {
    expect(validateInstallSubmission(good)).toEqual({
      ok: true,
      value: { ...good, lightHeadSerial: "RHEA000025111652", poleNumber: "TESTSL1-1001" },
    });
  });

  it.each([
    ["no body", null],
    ["no id", { ...good, id: " " }],
    ["bad capture time", { ...good, capturedAt: "soon" }],
    ["no location", { ...good, latitude: undefined }],
    ["no light head serial", { ...good, lightHeadSerial: "" }],
    ["no project", { ...good, projectId: "" }],
    ["notes not text", { ...good, notes: 7 }],
  ])("rejects %s", (_l, body) => {
    expect(validateInstallSubmission(body)).toMatchObject({ ok: false });
  });
});

describe("the gateway (required with the project)", () => {
  it("refuses an install without a gateway", () => {
    expect(validateInstallDraft(draft({ gateway: null }))).toMatchObject({ ok: false, errors: { gateway: "Select a gateway." } });
    expect(validateInstallDraft(draft({ gateway: { code: "  ", name: "x", groupId: null } }))).toMatchObject({ ok: false });
  });

  it("carries the gateway, with its Leadsun group id, through the server-side check", () => {
    const body = {
      id: "u1",
      projectId: "p1",
      gateway: { code: "GW-1", name: "PAS-1 Spine Road", groupId: 1890 },
      lightHeadSerial: "L",
      solarPanelSerial: "S",
      poleNumber: "PAS-1",
      latitude: 1,
      longitude: 2,
      capturedAt: "2026-10-29T12:00:00Z",
    };
    expect(validateInstallSubmission(body)).toMatchObject({ ok: true, value: { gateway: { code: "GW-1", name: "PAS-1 Spine Road", groupId: 1890 } } });
    // Saved before this update (no gateway): refused as incomplete.
    expect(validateInstallSubmission({ ...body, gateway: undefined })).toEqual({ ok: false, error: "Select a gateway." });
  });
});

