import { describe, expect, it } from "vitest";
import { connectedTone, overallStatusTone } from "../status";

describe("status tones (mirror the web's className mappings)", () => {
  it.each([
    ["Online", "active"],
    ["Offline", "flagged"],
    ["Disconnected", "flagged"],
    ["Unknown", "faint"],
    [null, "faint"],
  ])("connected %s -> %s", (label, tone) => expect(connectedTone(label)).toBe(tone));

  it.each([
    ["OK", "active"],
    ["Fault", "flagged"],
    ["Not Reporting", "muted"],
    ["Not Reporting 48H", "muted"],
    ["—", "faint"],
    [undefined, "faint"],
  ])("overall %s -> %s", (label, tone) => expect(overallStatusTone(label)).toBe(tone));
});
