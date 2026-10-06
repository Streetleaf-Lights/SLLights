import { describe, expect, it } from "vitest";
import {
  formatVitalsTick,
  formatVitalsTooltip,
  isVitalsDays,
  lineSegments,
  tickIndices,
  toVitalsPoints,
  vitalsLimitForDays,
  VITALS_SERIES,
} from "../vitals-chart";

describe("day options", () => {
  it("are the web's 1/2/7/14/30 days of hourly points", () => {
    expect([1, 2, 7, 14, 30].every(isVitalsDays)).toBe(true);
    expect(isVitalsDays(3)).toBe(false);
    expect(vitalsLimitForDays(7)).toBe(168);
  });
});

describe("labels (wall-clock, no timezone shift)", () => {
  it("shows the date at midnight and the hour otherwise", () => {
    expect(formatVitalsTick("2026-07-30 00:00:00-04:00")).toBe("Jul 30");
    expect(formatVitalsTick("2026-07-30 11:00:00-04:00")).toBe("11 AM");
    expect(formatVitalsTick("2026-07-30 12:00:00+00:00")).toBe("12 PM");
    expect(formatVitalsTick("2026-07-30 23:00:00-07:00")).toBe("11 PM");
  });

  it("always shows date and hour in the tooltip", () => {
    expect(formatVitalsTooltip("2026-07-30 00:00:00-04:00")).toBe("Jul 30, 12 AM");
    expect(formatVitalsTooltip("2026-12-01T15:00:00Z")).toBe("Dec 1, 3 PM");
  });

  it("falls back for missing or unreadable values", () => {
    expect(formatVitalsTick(null)).toBe("—");
    expect(formatVitalsTooltip("soon")).toBe("soon");
  });
});

describe("toVitalsPoints", () => {
  it("orders oldest to newest and maps the three averages", () => {
    const points = toVitalsPoints([
      { periodStart: "2026-07-30 02:00:00-04:00", avgLightPercentage: 2, avgPanelPercentage: 20, avgBatteryPercentage: 200 },
      { periodStart: "2026-07-30 01:00:00-04:00", avgLightPercentage: 1, avgPanelPercentage: 10, avgBatteryPercentage: null },
    ]);
    expect(points).toEqual([
      { periodStart: "2026-07-30 01:00:00-04:00", light: 1, panel: 10, battery: null },
      { periodStart: "2026-07-30 02:00:00-04:00", light: 2, panel: 20, battery: 200 },
    ]);
  });
});

describe("lineSegments", () => {
  it("breaks the line at gaps instead of bridging them", () => {
    expect(lineSegments([5, 6, null, null, 7, 8, 9, null, 1])).toEqual([[0, 1], [4, 5, 6], [8]]);
    expect(lineSegments([null, null])).toEqual([]);
    expect(lineSegments([])).toEqual([]);
  });
});

describe("tickIndices", () => {
  it("spreads labels across the data, always including both ends", () => {
    expect(tickIndices(48)).toEqual([0, 12, 24, 35, 47]);
    expect(tickIndices(3)).toEqual([0, 1, 2]);
    expect(tickIndices(0)).toEqual([]);
  });
});

describe("series", () => {
  it("are Light, Panel, Battery in that order", () => {
    expect(VITALS_SERIES.map((s) => s.label)).toEqual(["Light %", "Panel %", "Battery %"]);
  });
});
