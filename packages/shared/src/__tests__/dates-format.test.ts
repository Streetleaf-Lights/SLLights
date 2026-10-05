import { describe, expect, it } from "vitest";
import { parseApimDate } from "../dates";
import { formatPercent, formatTimestamp, initials, isSilentPole, panelLabelText } from "../format";

describe("parseApimDate", () => {
  it("parses APIM's space-before-offset format", () => {
    expect(parseApimDate("2026-09-11 16:46:16.000 -04:00")).toBe(Date.UTC(2026, 8, 11, 20, 46, 16));
  });

  it("parses the no-space offset format and plain ISO", () => {
    expect(parseApimDate("2026-07-26 13:25:41+00:00")).toBe(Date.UTC(2026, 6, 26, 13, 25, 41));
    expect(parseApimDate("2026-07-26T13:25:41Z")).toBe(Date.UTC(2026, 6, 26, 13, 25, 41));
  });

  it("returns NaN for empty or unparseable input", () => {
    expect(parseApimDate(null)).toBeNaN();
    expect(parseApimDate("")).toBeNaN();
    expect(parseApimDate("yesterday")).toBeNaN();
  });
});

describe("isSilentPole", () => {
  const now = Date.UTC(2026, 9, 1, 12, 0, 0);

  it("is false within 48h and true beyond it", () => {
    expect(isSilentPole("2026-09-30 12:00:00+00:00", now)).toBe(false);
    expect(isSilentPole("2026-09-29 11:59:00+00:00", now)).toBe(true);
  });

  it("reads the space-before-offset format instead of treating it as silent", () => {
    expect(isSilentPole("2026-10-01 08:00:00.000 -04:00", now)).toBe(false);
  });

  it("is true when missing or unparseable", () => {
    expect(isSilentPole(null, now)).toBe(true);
    expect(isSilentPole("nope", now)).toBe(true);
  });
});

describe("display formatting", () => {
  it("formats initials, percents and timestamps", () => {
    expect(initials("Coastal Power")).toBe("CP");
    expect(formatPercent(89.77)).toBe("89.8%");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(null)).toBe("—");
    expect(formatTimestamp("2026-08-24 14:07:15.524542+00:00")).toBe("2026-08-24 14:07");
    expect(formatTimestamp(null)).toBe("—");
  });

  it("appends the idle reason only when Idle", () => {
    expect(panelLabelText({ panelStatusText: "Idle", panelIdleReason: "Night" })).toBe("Idle (Night)");
    expect(panelLabelText({ panelStatusText: "OK", panelIdleReason: "Night" })).toBe("OK");
    expect(panelLabelText({ panelStatusText: null, panelIdleReason: null })).toBe("—");
  });
});

import { formatFullAddress } from "../format";

describe("formatFullAddress", () => {
  it("joins the parts that exist, like the web customer header", () => {
    expect(formatFullAddress({ address: "1 Main St", city: "Tampa", state: "FL", zip: "33602" })).toBe(
      "1 Main St, Tampa, FL 33602",
    );
    expect(formatFullAddress({ address: null, city: "Tampa", state: null, zip: "33602" })).toBe("Tampa 33602");
    expect(formatFullAddress({ address: null, city: null, state: null, zip: null })).toBeNull();
  });
});
