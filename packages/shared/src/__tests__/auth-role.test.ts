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

import { isStreetleafStaff } from "../auth-role";

describe("isStreetleafStaff", () => {
  it.each([
    ["Streetleaf Admin", null, true],
    ["User", null, true], // a "Streetleaf User" / crew member
    ["Customer Admin", "c1", false],
    ["Customer Owner", "c1", false],
    ["User", "c1", false], // a "Customer User"
    [null, null, false],
  ])("role %s with customerId %s -> %s", (role, customerId, expected) => {
    expect(isStreetleafStaff(role, customerId)).toBe(expected);
  });
});
