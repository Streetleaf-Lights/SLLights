import { describe, expect, it } from "vitest";
import { POLE_INSTALL_NOTES_MAX_LENGTH, validatePoleInstallRequest } from "../api-contract";

const valid = {
  poleNumber: " pas-4938 ",
  scannedValue: "PAS-4938",
  latitude: 27.95,
  longitude: -82.46,
  accuracyMeters: 4.2,
  capturedAt: "2026-10-01T12:00:00.000Z",
  notes: "  Base plate replaced  ",
};

describe("validatePoleInstallRequest", () => {
  it("accepts and normalizes a valid payload", () => {
    expect(validatePoleInstallRequest(valid)).toEqual({
      ok: true,
      value: { ...valid, poleNumber: "PAS-4938", notes: "Base plate replaced" },
    });
  });

  it("accepts null scannedValue, accuracy and notes, and blanks notes to null", () => {
    const result = validatePoleInstallRequest({ ...valid, scannedValue: null, accuracyMeters: null, notes: "  " });
    expect(result).toMatchObject({ ok: true, value: { scannedValue: null, accuracyMeters: null, notes: null } });
  });

  it.each([
    ["non-object body", null],
    ["missing poleNumber", { ...valid, poleNumber: " " }],
    ["non-string scannedValue", { ...valid, scannedValue: 5 }],
    ["latitude out of range", { ...valid, latitude: 91 }],
    ["NaN latitude", { ...valid, latitude: Number.NaN }],
    ["longitude out of range", { ...valid, longitude: -181 }],
    ["missing longitude", { ...valid, longitude: undefined }],
    ["negative accuracy", { ...valid, accuracyMeters: -1 }],
    ["bad capturedAt", { ...valid, capturedAt: "whenever" }],
    ["non-string notes", { ...valid, notes: 3 }],
    ["notes too long", { ...valid, notes: "x".repeat(POLE_INSTALL_NOTES_MAX_LENGTH + 1) }],
  ])("rejects %s", (_label, body) => {
    expect(validatePoleInstallRequest(body)).toMatchObject({ ok: false });
  });
});
