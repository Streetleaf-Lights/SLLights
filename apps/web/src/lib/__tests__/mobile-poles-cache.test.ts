import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testToken } from "@/testing/testToken";

const { getPolesMock } = vi.hoisted(() => ({ getPolesMock: vi.fn() }));
vi.mock("@/lib/apim", () => ({ getPoles: getPolesMock }));

import { cachedPoles, clearPolesCache } from "@/lib/mobile-poles";

const exp = Math.floor(Date.now() / 1000) + 3600;
const tokenFor = (sub: string, role = "Streetleaf Admin") => testToken({ sub, role, exp });
const list = (who: string) => [{ id: `${who}-pole`, poleNumber: `${who}-1` }];

beforeEach(() => {
  clearPolesCache();
  // Each person's token gets their own list back, as APIM now does.
  getPolesMock.mockImplementation(async (_scope: unknown, token: string) => list(token === tokenFor("crew-1", "Streetleaf Crew") ? "crew" : token.slice(-6)));
});
afterEach(() => {
  getPolesMock.mockReset();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("cachedPoles: one copy per person, never shared", () => {
  it("never serves one person's list to another, even for the same scope", async () => {
    const crew = await cachedPoles({}, tokenFor("crew-1", "Streetleaf Crew"));
    const admin = await cachedPoles({}, tokenFor("admin-1"));
    expect(getPolesMock).toHaveBeenCalledTimes(2);
    expect(crew).not.toBe(admin);
    expect(crew[0].poleNumber).toBe("crew-1");
  });

  it("reuses a person's own copy within the time limit (page turns, searches)", async () => {
    const t = tokenFor("admin-1");
    await cachedPoles({}, t);
    await cachedPoles({}, t);
    await cachedPoles({}, t);
    expect(getPolesMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a separate copy per scope for the same person", async () => {
    const t = tokenFor("admin-1");
    await cachedPoles({}, t);
    await cachedPoles({ customerId: "c1" }, t);
    expect(getPolesMock).toHaveBeenCalledTimes(2);
    expect(getPolesMock).toHaveBeenLastCalledWith({ customerId: "c1" }, t);
  });

  it("fetches afresh after POLES_CACHE_SECONDS (default 3 minutes)", async () => {
    vi.useFakeTimers();
    const t = tokenFor("admin-1");
    await cachedPoles({}, t);
    vi.advanceTimersByTime(179_000);
    await cachedPoles({}, t);
    expect(getPolesMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await cachedPoles({}, t);
    expect(getPolesMock).toHaveBeenCalledTimes(2);

    vi.stubEnv("POLES_CACHE_SECONDS", "0"); // turned off
    await cachedPoles({}, t);
    await cachedPoles({}, t);
    expect(getPolesMock).toHaveBeenCalledTimes(4);
  });

  it("doesn't cache when the token has no user", async () => {
    await cachedPoles({}, "not-a-jwt");
    await cachedPoles({}, "not-a-jwt");
    expect(getPolesMock).toHaveBeenCalledTimes(2);
  });

  it("holds at most 30 copies, dropping the oldest", async () => {
    for (let i = 0; i < 31; i++) await cachedPoles({}, tokenFor(`user-${i}`));
    expect(getPolesMock).toHaveBeenCalledTimes(31);
    await cachedPoles({}, tokenFor("user-30")); // newest: still held
    expect(getPolesMock).toHaveBeenCalledTimes(31);
    await cachedPoles({}, tokenFor("user-0")); // oldest: dropped
    expect(getPolesMock).toHaveBeenCalledTimes(32);
  });

  it("doesn't keep a failed fetch", async () => {
    const t = tokenFor("admin-1");
    getPolesMock.mockRejectedValueOnce(new Error("APIM down"));
    await expect(cachedPoles({}, t)).rejects.toThrow("APIM down");
    await Promise.resolve();
    await cachedPoles({}, t);
    expect(getPolesMock).toHaveBeenCalledTimes(2);
  });
});
