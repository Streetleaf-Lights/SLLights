import { describe, expect, it } from "vitest";
import {
  buildPoleStatusCards,
  connectionStatusTone,
  formatSunsetExpectation,
  issueStatusTone,
  sortIssuesNewestFirst,
} from "../pole-detail";
import type { PoleVital } from "../types";

describe("formatSunsetExpectation", () => {
  it("names the US zone, DST-aware", () => {
    expect(formatSunsetExpectation("2026-08-28 19:54:31.130526-04:00")).toBe("Expected ON @ 19:54 EDT");
    expect(formatSunsetExpectation("2026-01-15 17:40:00-05:00")).toBe("Expected ON @ 17:40 EST");
    expect(formatSunsetExpectation("2026-08-28 19:54:31-05:00")).toBe("Expected ON @ 19:54 CDT");
    expect(formatSunsetExpectation("2026-08-28 19:54:31+02:00")).toBe("Expected ON @ 19:54 UTC+2");
    expect(formatSunsetExpectation("tonight")).toBeNull();
    expect(formatSunsetExpectation(null)).toBeNull();
  });
});

describe("connectionStatusTone", () => {
  it("distinguishes Online, Offline, Disconnected and Unknown", () => {
    expect(connectionStatusTone(true, null)).toEqual({ text: "Online", tone: "active" });
    expect(connectionStatusTone(false, null)).toEqual({ text: "Offline", tone: "flagged" });
    expect(connectionStatusTone(null, "2026-10-01")).toEqual({ text: "Disconnected", tone: "flagged" });
    expect(connectionStatusTone(null, null)).toEqual({ text: "Unknown", tone: "faint" });
  });
});

describe("buildPoleStatusCards", () => {
  it("dashes the telemetry cards when connectivity is Unknown, but keeps Issue Entry", () => {
    const pole = { isOnline: null, lastUpdate: null, isLedFault: true, isPanelFault: false, isBatteryFault: true,
      isOpenIssueFault: true, lampPower2: 1, batteryElecCurrent2: 1, batteryVoltage2: 1, avgLightPercentage: 50,
      lightStatusText: "ON", panelStatusText: null, panelIdleReason: null, batteryStatusText: null } as unknown as PoleVital;
    const cards = buildPoleStatusCards(pole, false);
    expect(cards.map((c) => c.status.text)).toEqual(["—", "—", "—", "Yes"]);
    expect(cards[0].metrics.find((m) => m.label === "48H Average Light %")?.value).toBe("—");
  });
});

describe("issues", () => {
  it("colours open red, closed green, anything else neutral", () => {
    expect(issueStatusTone(" Open ")).toBe("flagged");
    expect(issueStatusTone("closed")).toBe("active");
    expect(issueStatusTone("In Progress")).toBe("muted");
  });

  it("sorts newest first using APIM's timestamp format, unparseable last", () => {
    const sorted = sortIssuesNewestFirst([
      { id: "old", dateReported: "2026-09-01 08:00:00.000 -04:00" },
      { id: "bad", dateReported: "n/a" },
      { id: "new", dateReported: "2026-09-30 08:00:00.000 -04:00" },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old", "bad"]);
  });
});

import { hasMapLocation } from "../pole-detail";

describe("hasMapLocation", () => {
  it("accepts real coordinates and rejects missing, non-finite or out-of-range ones", () => {
    expect(hasMapLocation(27.95, -82.46)).toBe(true);
    expect(hasMapLocation(0, 0)).toBe(true);
    expect(hasMapLocation(null, -82.46)).toBe(false);
    expect(hasMapLocation(27.95, undefined)).toBe(false);
    expect(hasMapLocation(Number.NaN, 1)).toBe(false);
    expect(hasMapLocation(91, 1)).toBe(false);
    expect(hasMapLocation(1, -181)).toBe(false);
  });
});

import { mapRegionForPoints } from "../pole-detail";

describe("mapRegionForPoints", () => {
  it("centres a single pole at street level", () => {
    expect(mapRegionForPoints([{ lat: 27.95, long: -82.46 }])).toEqual({
      latitude: 27.95,
      longitude: -82.46,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    });
  });

  it("fits every pole with a margin", () => {
    const region = mapRegionForPoints([
      { lat: 27.9, long: -82.5 },
      { lat: 28.0, long: -82.3 },
      { lat: 27.95, long: -82.4 },
    ])!;
    expect(region.latitude).toBeCloseTo(27.95);
    expect(region.longitude).toBeCloseTo(-82.4);
    expect(region.latitudeDelta).toBeCloseTo(0.14); // 0.1 span × 1.4
    expect(region.longitudeDelta).toBeCloseTo(0.28); // 0.2 span × 1.4
    // Every pole is inside the region.
    for (const p of [{ lat: 27.9, long: -82.5 }, { lat: 28.0, long: -82.3 }]) {
      expect(Math.abs(p.lat - region.latitude)).toBeLessThanOrEqual(region.latitudeDelta / 2);
      expect(Math.abs(p.long - region.longitude)).toBeLessThanOrEqual(region.longitudeDelta / 2);
    }
  });

  it("never zooms closer than street level for poles close together", () => {
    const region = mapRegionForPoints([{ lat: 27.95, long: -82.46 }, { lat: 27.9501, long: -82.4601 }])!;
    expect(region.latitudeDelta).toBe(0.004);
  });

  it("ignores poles without usable coordinates, and is null when none are left", () => {
    expect(mapRegionForPoints([{ lat: null, long: 1 }, { lat: 27.95, long: -82.46 }])?.latitude).toBe(27.95);
    expect(mapRegionForPoints([{ lat: null, long: null }, { lat: 200, long: 1 }])).toBeNull();
    expect(mapRegionForPoints([])).toBeNull();
  });
});
