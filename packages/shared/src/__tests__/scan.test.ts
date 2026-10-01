import { describe, expect, it } from "vitest";
import { parsePoleCode } from "../scan";

describe("parsePoleCode", () => {
  it("accepts a bare pole number, trimming and uppercasing it", () => {
    expect(parsePoleCode("  pas-4938\n")).toEqual({ ok: true, poleNumber: "PAS-4938" });
  });

  it("reads poleNumber or pole query params from a URL", () => {
    expect(parsePoleCode("https://streetleaf.com/p?poleNumber=PAS-1")).toEqual({ ok: true, poleNumber: "PAS-1" });
    expect(parsePoleCode("https://streetleaf.com/p?x=1&pole=pas-2#top")).toEqual({ ok: true, poleNumber: "PAS-2" });
  });

  it("falls back to the last path segment of a URL", () => {
    expect(parsePoleCode("https://streetleaf.com/poles/PAS-77/")).toEqual({ ok: true, poleNumber: "PAS-77" });
  });

  it("rejects empty input", () => {
    expect(parsePoleCode("   ")).toMatchObject({ ok: false });
    expect(parsePoleCode(null)).toMatchObject({ ok: false });
  });

  it("rejects payloads that don't look like pole numbers", () => {
    expect(parsePoleCode("hello world")).toMatchObject({ ok: false });
    expect(parsePoleCode("-PAS")).toMatchObject({ ok: false });
    expect(parsePoleCode("X")).toMatchObject({ ok: false });
    expect(parsePoleCode("A".repeat(41))).toMatchObject({ ok: false });
    expect(parsePoleCode("https://streetleaf.com/")).toMatchObject({ ok: false });
  });

  it("doesn't throw on malformed percent-encoding", () => {
    expect(parsePoleCode("https://x.com/p?pole=%E0%A4%A")).toMatchObject({ ok: false });
  });
});
