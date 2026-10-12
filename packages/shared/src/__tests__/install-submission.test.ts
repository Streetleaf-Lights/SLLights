import { describe, expect, it } from "vitest";
import { validateInstallDraft, type InstallDraft } from "../install-submission";

const draft = (extra: Partial<InstallDraft> = {}): InstallDraft => ({
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
    expect(validateInstallDraft(draft({ lightHeadSerial: " ", solarPanelSerial: "", poleNumber: "  ", location: null }))).toEqual({
      ok: false,
      errors: {
        lightHeadSerial: "Light Head Serial Number is required.",
        solarPanelSerial: "Solar Panel Serial Number is required.",
        poleNumber: "Pole Number is required.",
        location: "Location is required. Get the location before submitting.",
      },
    });
  });

  it.each([
    ["missing light head serial", { lightHeadSerial: "" }, "lightHeadSerial"],
    ["missing solar panel serial", { solarPanelSerial: "  " }, "solarPanelSerial"],
    ["missing pole number", { poleNumber: "" }, "poleNumber"],
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
