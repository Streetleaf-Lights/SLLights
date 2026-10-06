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
