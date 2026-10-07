import { afterEach, describe, expect, it, vi } from "vitest";

const { registerMock, revalidateMock } = vi.hoisted(() => ({ registerMock: vi.fn(), revalidateMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: revalidateMock }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, registerUser: registerMock };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/mobile/registeruser/route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/mobile/registeruser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const user = { id: "u1", name: "Nia", email: "nia@c.com", role: "User", customerId: "c1" };

afterEach(() => [registerMock, revalidateMock].forEach((m) => m.mockReset()));

describe("POST /api/mobile/registeruser", () => {
  it("completes the invite and returns the session token in the body (no cookie)", async () => {
    registerMock.mockResolvedValue({ token: "jwt", user });
    const res = await post({ token: "invite-123", password: "goodpass!" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "jwt", user });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(registerMock).toHaveBeenCalledWith("invite-123", "goodpass!");
    expect(revalidateMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["no invite token", { token: " ", password: "goodpass!" }],
    ["no password", { token: "t", password: "" }],
    ["too short", { token: "t", password: "ab!" }],
    ["no special character", { token: "t", password: "abcdefgh" }],
  ])("400s %s, without calling APIM", async (_l, body) => {
    expect((await post(body)).status).toBe(400);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("passes an expired or used invite's error through", async () => {
    registerMock.mockRejectedValue(new ApimError("This invite link has expired.", 400));
    const res = await post({ token: "old", password: "goodpass!" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This invite link has expired.");
  });
});
