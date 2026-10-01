import { createScanGate } from "@/scan/scanGate";

describe("createScanGate", () => {
  it("lets one read through, then blocks everything until re-armed", () => {
    const gate = createScanGate(1000, () => 0);
    expect(gate.accept("A")).toBe(true);
    expect(gate.accept("A")).toBe(false);
    expect(gate.accept("B")).toBe(false);
  });

  it("after re-arming, accepts a different code at once but holds the same one for the cooldown", () => {
    let now = 0;
    const gate = createScanGate(1000, () => now);
    gate.accept("A");
    gate.rearm();
    expect(gate.accept("A")).toBe(false);
    now = 999;
    expect(gate.accept("A")).toBe(false);
    now = 1000;
    expect(gate.accept("A")).toBe(true);

    gate.rearm();
    expect(gate.accept("B")).toBe(true);
  });
});
