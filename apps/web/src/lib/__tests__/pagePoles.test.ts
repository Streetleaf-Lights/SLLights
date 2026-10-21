import { describe, expect, it } from "vitest";
import type { PoleSummary } from "@sllights/shared/types";
import { pagePoles } from "@/lib/pagePoles";

const poles = Array.from({ length: 25 }, (_, i) => ({ id: `p${i + 1}`, poleNumber: `PAS-${String(i + 1).padStart(3, "0")}` }) as PoleSummary);

describe("pagePoles", () => {
  it("returns one page of 10, with the totals", () => {
    const p = pagePoles(poles, undefined, "2");
    expect(p.rows.map((r) => r.poleNumber)).toEqual(poles.slice(10, 20).map((r) => r.poleNumber));
    expect([p.total, p.unfilteredTotal, p.page, p.totalPages]).toEqual([25, 25, 2, 3]);
  });

  it("searches pole numbers (any case, trimmed) and counts the matches", () => {
    const p = pagePoles(poles, "  pas-01 ", undefined);
    expect(p.rows.map((r) => r.poleNumber)).toEqual(["PAS-010", "PAS-011", "PAS-012", "PAS-013", "PAS-014", "PAS-015", "PAS-016", "PAS-017", "PAS-018", "PAS-019"]);
    expect([p.total, p.unfilteredTotal]).toEqual([10, 25]);
  });

  it.each([[undefined, 1], ["0", 1], ["-3", 1], ["abc", 1], ["2.7", 2], ["99", 3]])("treats page %p as page %p", (page, shown) => {
    expect(pagePoles(poles, undefined, page).page).toBe(shown);
  });

  it("handles no poles and no matches", () => {
    expect(pagePoles([], undefined, "1")).toMatchObject({ rows: [], total: 0, unfilteredTotal: 0, page: 1, totalPages: 1 });
    expect(pagePoles(poles, "zzz", "1")).toMatchObject({ rows: [], total: 0, unfilteredTotal: 25 });
  });
});
