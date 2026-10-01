/**
 * The camera fires onBarcodeScanned many times a second while a code is in
 * view. This gate lets one read through, then ignores everything until it's
 * re-armed (when the crew member comes back to the scanner) — and, after
 * re-arming, keeps ignoring the *same* value for a short cooldown, so the
 * tag still in frame doesn't instantly re-open the screen they just left.
 */
export function createScanGate(cooldownMs = 2500, now: () => number = Date.now) {
  let locked = false;
  let lastValue: string | null = null;
  let lastAt = 0;

  return {
    /** True if this read should be handled; false if it should be ignored. */
    accept(value: string): boolean {
      if (locked) return false;
      if (value === lastValue && now() - lastAt < cooldownMs) return false;
      locked = true;
      lastValue = value;
      lastAt = now();
      return true;
    },
    /** Allow reads again; the last value stays on cooldown. */
    rearm() {
      locked = false;
      lastAt = now();
    },
  };
}
