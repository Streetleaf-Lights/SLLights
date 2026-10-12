import { barcodeCenter, createSteadyReading, insideFrame } from "@/scan/scanFrame";

const frame = { x: 50, y: 200, width: 280, height: 110 };

describe("barcodeCenter", () => {
  it("uses the corner points when there are some", () => {
    const corners = [
      { x: 100, y: 240 },
      { x: 200, y: 240 },
      { x: 200, y: 280 },
      { x: 100, y: 280 },
    ];
    expect(barcodeCenter({ cornerPoints: corners, bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } })).toEqual({ x: 150, y: 260 });
  });

  it("falls back to the bounding box (e.g. iOS Code 39), and is null with neither", () => {
    expect(barcodeCenter({ cornerPoints: [], bounds: { origin: { x: 100, y: 240 }, size: { width: 100, height: 40 } } })).toEqual({ x: 150, y: 260 });
    expect(barcodeCenter({ cornerPoints: [], bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } } })).toBeNull();
  });
});

describe("insideFrame", () => {
  it("accepts the barcode in the frame and rejects its neighbour just outside", () => {
    expect(insideFrame({ x: 190, y: 255 }, frame)).toBe(true);
    expect(insideFrame({ x: 190, y: 340 }, frame)).toBe(false); // the next barcode down the sticker
    expect(insideFrame({ x: 190, y: 160 }, frame)).toBe(false); // the one above
  });

  it("allows a small margin at the edges", () => {
    expect(insideFrame({ x: 190, y: 315 }, frame)).toBe(true);
    expect(insideFrame({ x: 190, y: 320 }, frame)).toBe(false);
  });
});

describe("createSteadyReading", () => {
  it("only reports a code after three reads in a row", () => {
    const steady = createSteadyReading();
    expect(steady("A")).toBeNull();
    expect(steady("A")).toBeNull();
    expect(steady("A")).toBe("A");
    expect(steady("A")).toBe("A");
  });

  it("restarts the count when a different code is glimpsed, so it doesn't flip back and forth", () => {
    const steady = createSteadyReading();
    expect([steady("A"), steady("B"), steady("A"), steady("B")]).toEqual([null, null, null, null]);
    expect([steady("B"), steady("B")]).toEqual([null, "B"]);
  });
});
