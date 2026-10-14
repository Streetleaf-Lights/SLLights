import { describe, expect, it } from "vitest";
import { formatInstallLocation, installFields } from "@/lib/airtableInstalls";

describe("Airtable install fields", () => {
  it("formats coordinates as the table records them (longitude first)", () => {
    expect(formatInstallLocation(28.196376054573985, -82.26689041599842)).toBe(
      "Longitude: -82.26689041599842 Latitude: 28.196376054573985",
    );
  });

  it("uses the exact field names, including the trailing space on Location Coordinates", () => {
    const fields = installFields({
      id: "x",
      projectId: "p",
      lightHeadSerial: "L",
      solarPanelSerial: "S",
      poleNumber: "P-1",
      latitude: 1,
      longitude: 2,
      accuracyMeters: null,
      capturedAt: "2026-10-14T00:00:00Z",
      notes: null,
    });
    expect(Object.keys(fields)).toEqual(["Pole Number", "Solar Panel Serial", "Lighthead Serial", "Location Coordinates "]);
  });
});
