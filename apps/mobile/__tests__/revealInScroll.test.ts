import type { View } from "react-native";
import { revealInScroll } from "@/ui/revealInScroll";

const target = (y: number) =>
  ({ measureLayout: (_node: unknown, onSuccess: (x: number, y: number) => void) => onSuccess(0, y) }) as unknown as View;

describe("revealInScroll", () => {
  it("scrolls so the target sits just below the top", () => {
    const scrollTo = jest.fn();
    revealInScroll(target(800), { node: {}, scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(776); // 24pt margin
  });

  it("never scrolls past the top", () => {
    const scrollTo = jest.fn();
    revealInScroll(target(10), { node: {}, scrollTo });
    expect(scrollTo).toHaveBeenCalledWith(0);
  });

  it("does nothing without a target or a scroll container", () => {
    const scrollTo = jest.fn();
    revealInScroll(null, { node: {}, scrollTo });
    revealInScroll(target(100), { node: undefined, scrollTo });
    revealInScroll(target(100), null);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
