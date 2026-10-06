import { describe, expect, it } from "vitest";
import { decodeSessionToken, getSecondsUntilExpiry, isCustomerScoped } from "../auth-role";
import { makeToken } from "./helpers";

describe("decodeSessionToken", () => {
  it("returns id, role and customerId", () => {
    expect(decodeSessionToken(makeToken({ sub: "u1", role: "Customer Owner", customerId: "c1" }))).toEqual({
      id: "u1",
      role: "Customer Owner",
      customerId: "c1",
    });
  });

  it("treats a missing or non-string customerId as null", () => {
    expect(decodeSessionToken(makeToken({ sub: "u1", role: "Streetleaf Admin" }))?.customerId).toBeNull();
    expect(decodeSessionToken(makeToken({ sub: "u1", role: "User", customerId: 7 }))?.customerId).toBeNull();
  });

  it("returns null without string sub and role claims", () => {
    expect(decodeSessionToken(makeToken({ role: "User" }))).toBeNull();
    expect(decodeSessionToken(makeToken({ sub: "u1" }))).toBeNull();
    expect(decodeSessionToken("garbage")).toBeNull();
  });
});

describe("isCustomerScoped", () => {
  it.each([
    ["Customer Admin", "c1", true],
    ["Customer Owner", "c1", true],
    ["User", "c1", true],
    ["User", null, false],
    ["Streetleaf Admin", null, false],
    ["Streetleaf Admin", "c1", false],
    [null, null, false],
  ])("role %s with customerId %s -> %s", (role, customerId, expected) => {
    expect(isCustomerScoped(role, customerId)).toBe(expected);
  });
});

describe("getSecondsUntilExpiry", () => {
  const now = Date.UTC(2026, 9, 1, 12, 0, 0);
  const nowSeconds = Math.floor(now / 1000);

  it("returns seconds until exp", () => {
    expect(getSecondsUntilExpiry(makeToken({ exp: nowSeconds + 90 }), now)).toBe(90);
  });

  it("clamps an expired token to 0", () => {
    expect(getSecondsUntilExpiry(makeToken({ exp: nowSeconds - 5 }), now)).toBe(0);
  });

  it("returns null without a numeric exp", () => {
    expect(getSecondsUntilExpiry(makeToken({ exp: "soon" }), now)).toBeNull();
    expect(getSecondsUntilExpiry("bad", now)).toBeNull();
  });
});

import { canUseFieldTools } from "../auth-role";

describe("canUseFieldTools", () => {
  it.each([
    ["Streetleaf Admin", true],
    ["Streetleaf Crew", true],
    ["User", false], // Streetleaf User or Customer User alike
    ["Customer Admin", false],
    ["Customer Owner", false],
    ["streetleaf admin", false], // exact role names only
    [null, false],
  ])("%s -> %s", (role, expected) => {
    expect(canUseFieldTools(role)).toBe(expected);
  });
});

describe("decodeSessionToken: 'no customer' sentinels", () => {
  // Token issuers often can't emit a null claim, so "no customer" arrives as
  // an empty string (or an all-zero GUID) instead of a missing claim.
  it.each([
    ["empty string", ""],
    ["whitespace", "  "],
    ["all-zero GUID", "00000000-0000-0000-0000-000000000000"],
  ])("treats %s as no customer", (_label, customerId) => {
    const session = decodeSessionToken(makeToken({ sub: "u1", role: "User", customerId }));
    expect(session?.customerId).toBeNull();
    expect(isCustomerScoped(session?.role, session?.customerId)).toBe(false);
  });

  it("keeps a real customer id (trimmed)", () => {
    expect(decodeSessionToken(makeToken({ sub: "u1", role: "User", customerId: " c1 " }))?.customerId).toBe("c1");
  });
});
