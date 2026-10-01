import { isUsableSession, sessionStore } from "@/auth/sessionStore";
import { futureExp, makeToken } from "../test-utils/helpers";

const user = { id: "u1", name: "Crew", email: "c@s.com", role: "User", customerId: null };

describe("isUsableSession", () => {
  it("accepts a decodable, unexpired token with a user", () => {
    expect(isUsableSession({ token: makeToken({ sub: "u1", role: "User", exp: futureExp() }), user })).toBe(true);
  });

  it("rejects expired, undecodable or incomplete sessions", () => {
    expect(isUsableSession({ token: makeToken({ sub: "u1", role: "User", exp: 1 }), user })).toBe(false);
    expect(isUsableSession({ token: "garbage", user })).toBe(false);
    expect(isUsableSession({ token: makeToken({ sub: "u1", role: "User" }) })).toBe(false);
    expect(isUsableSession(null)).toBe(false);
  });
});

describe("sessionStore", () => {
  it("round-trips a usable session", async () => {
    const session = { token: makeToken({ sub: "u1", role: "User", exp: futureExp() }), user };
    await sessionStore.save(session);
    expect(await sessionStore.load()).toEqual(session);
  });

  it("clears and ignores an expired or corrupt entry", async () => {
    const SecureStore = jest.requireMock("expo-secure-store");
    await SecureStore.setItemAsync("sllights.session", "{not json");
    expect(await sessionStore.load()).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
