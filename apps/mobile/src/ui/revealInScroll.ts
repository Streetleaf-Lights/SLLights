import type { View } from "react-native";

/** A scroll container to reveal things in: its native node (for measuring) and how to scroll it. */
export interface ScrollTarget {
  node: unknown;
  scrollTo: (y: number) => void;
}

/**
 * Scrolls `container` so `target` sits near its top (with a small margin).
 * Measures the target's position within the scroll content, so it works
 * however deep the target is nested (e.g. a light row inside a list header).
 */
export function revealInScroll(target: View | null, container: ScrollTarget | null, margin = 24) {
  if (!target || !container?.node) return;
  target.measureLayout(
    container.node as never,
    (_x, y) => container.scrollTo(Math.max(0, y - margin)),
    () => undefined,
  );
}
