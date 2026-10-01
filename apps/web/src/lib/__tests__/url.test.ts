import { describe, expect, it } from "vitest";
import { withQueryParam, withSearchContext } from "@/lib/url";

describe("withQueryParam", () => {
  it("appends a query param when a value is present", () => {
    expect(withQueryParam("/customers", "q", "coastal")).toBe("/customers?q=coastal");
  });

  it("returns the path unchanged when value is undefined", () => {
    expect(withQueryParam("/customers", "q", undefined)).toBe("/customers");
  });

  it("returns the path unchanged when value is null", () => {
    expect(withQueryParam("/customers", "q", null)).toBe("/customers");
  });

  it("returns the path unchanged when value is an empty string", () => {
    expect(withQueryParam("/customers", "q", "")).toBe("/customers");
  });

  it("URL-encodes the value", () => {
    expect(withQueryParam("/customers", "q", "coastal power & light")).toBe(
      "/customers?q=coastal%20power%20%26%20light",
    );
  });

  it("uses & instead of ? when the path already has a query string", () => {
    expect(withQueryParam("/customers?sort=name", "q", "coastal")).toBe(
      "/customers?sort=name&q=coastal",
    );
  });
});

describe("withSearchContext", () => {
  it("appends only cust_q when only a customer search is present", () => {
    expect(withSearchContext("/customers/r2", "coastal", undefined)).toBe(
      "/customers/r2?cust_q=coastal",
    );
  });

  it("appends only pole_q when only a pole search is present", () => {
    expect(withSearchContext("/customers/r2", undefined, "12057")).toBe(
      "/customers/r2?pole_q=12057",
    );
  });

  it("appends both when both are present", () => {
    expect(withSearchContext("/customers/r2", "coastal", "12057")).toBe(
      "/customers/r2?cust_q=coastal&pole_q=12057",
    );
  });

  it("returns the path unchanged when neither is present", () => {
    expect(withSearchContext("/customers/r2")).toBe("/customers/r2");
  });
});
