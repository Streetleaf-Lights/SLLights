import type { BarcodeScanningResult } from "expo-camera";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a barcode sits in the camera view: the middle of its corner points,
 * or of its bounding box when there are no corners (iOS gives none for
 * Code 39 / PDF417). Both platforms report these in the camera view's own
 * coordinates. Null when neither is available.
 */
export function barcodeCenter(result: Pick<BarcodeScanningResult, "cornerPoints" | "bounds">): { x: number; y: number } | null {
  const corners = result.cornerPoints ?? [];
  if (corners.length > 0) {
    return {
      x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
      y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
    };
  }
  const b = result.bounds;
  if (b && b.size && b.size.width > 0 && b.size.height > 0) {
    return { x: b.origin.x + b.size.width / 2, y: b.origin.y + b.size.height / 2 };
  }
  return null;
}

/** Whether a point is inside the frame, allowing a small margin for a barcode that's just on its edge. */
export function insideFrame(point: { x: number; y: number }, frame: Rect, margin = 8): boolean {
  return (
    point.x >= frame.x - margin &&
    point.x <= frame.x + frame.width + margin &&
    point.y >= frame.y - margin &&
    point.y <= frame.y + frame.height + margin
  );
}

/**
 * Steadies the readout: a code counts only once it's been read
 * `hitsNeeded` times in a row (a passing glimpse of the neighbouring
 * barcode resets the count instead of flipping the display). Returns the
 * steady value, or null while still settling.
 */
export function createSteadyReading(hitsNeeded = 3) {
  let candidate: string | null = null;
  let hits = 0;
  return (value: string): string | null => {
    if (value === candidate) hits += 1;
    else {
      candidate = value;
      hits = 1;
    }
    return hits >= hitsNeeded ? value : null;
  };
}
