import { describe, expect, it } from "vitest";
import { getPageWindow, paginate } from "../pagination";

const items = Array.from({ length: 23 }, (_, i) => i + 1);

describe("paginate", () => {
  it("slices pages of 10 by default", () => {
    expect(paginate(items, 1)).toMatchObject({ items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], page: 1, totalPages: 3, totalItems: 23, firstItem: 1, lastItem: 10 });
    expect(paginate(items, 3)).toMatchObject({ items: [21, 22, 23], page: 3, firstItem: 21, lastItem: 23 });
  });

  it("clamps out-of-range and invalid page numbers", () => {
    expect(paginate(items, 9).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it("reports one empty page for no items", () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1, totalItems: 0, firstItem: 0, lastItem: 0 });
  });

  it("honours a custom page size", () => {
    expect(paginate(items, 2, 5)).toMatchObject({ items: [6, 7, 8, 9, 10], totalPages: 5 });
  });
});

describe("getPageWindow (size 3, as on mobile)", () => {
  it("centres on the current page and shifts at the ends", () => {
    expect(getPageWindow(1, 6, 3)).toEqual([1, 2, 3]);
    expect(getPageWindow(4, 6, 3)).toEqual([3, 4, 5]);
    expect(getPageWindow(6, 6, 3)).toEqual([4, 5, 6]);
    expect(getPageWindow(2, 2, 3)).toEqual([1, 2]);
  });
});

import { getPagerLayout } from "../pagination";

/** Renders the layout as a compact string with the arrows, e.g. "1 ‹ … 4 5 6 … › 9". */
const row = (current: number, total: number) => {
  const { first, middle, last } = getPagerLayout(current, total);
  return [
    first ?? "",
    "‹",
    ...middle.map((item) => (item.kind === "page" ? String(item.page) : "…")),
    "›",
    last ?? "",
  ]
    .join(" ")
    .trim();
};

describe("getPagerLayout", () => {
  it("puts the first and last page outside the arrows, like the web", () => {
    expect(row(1, 9)).toBe("‹ 1 2 3 … › 9");
    expect(row(5, 9)).toBe("1 ‹ … 4 5 6 … › 9");
    expect(row(9, 9)).toBe("1 ‹ … 7 8 9 ›");
  });

  it("never puts … between neighbouring pages", () => {
    expect(row(3, 9)).toBe("1 ‹ 2 3 4 … › 9"); // window starts at 2: no leading gap
    expect(row(7, 9)).toBe("1 ‹ … 6 7 8 › 9"); // window ends at 8: no trailing gap
    expect(row(2, 4)).toBe("‹ 1 2 3 › 4");
    expect(row(3, 4)).toBe("1 ‹ 2 3 4 ›");
  });

  it("doesn't repeat the first or last page when the window already has it", () => {
    expect(row(1, 3)).toBe("‹ 1 2 3 ›");
    expect(row(2, 2)).toBe("‹ 1 2 ›");
  });

  it("is empty for a single page", () => {
    expect(getPagerLayout(1, 1)).toEqual({ first: null, middle: [], last: null });
  });
});
