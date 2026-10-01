import { afterEach, describe, expect, it, vi } from "vitest";

const { registerUserMock, revalidateTagMock } = vi.hoisted(() => ({
  registerUserMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    registerUser: registerUserMock,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/registeruser/route";

function request(body: unknown) {
  return new Request("http://localhost/api/registeruser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

function maxAgeFromSetCookie(res: Response): number | null {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/Max-Age=(\d+)/i);
  return match ? Number(match[1]) : null;
}

describe("POST /api/registeruser", () => {
  afterEach(() => {
    registerUserMock.mockReset();
    revalidateTagMock.mockReset();
  });

  const authUser = {
    id: "1445C5D1-37C2-43CF-9F82-6223F425B265",
    name: "Minh South Oak",
    email: "minh+1@streetleaf.com",
    role: "Customer Admin",
    customerId: "rec5uaHZMOGZGyVcY",
  };

  it("returns the user (not the token) on success", async () => {
    registerUserMock.mockResolvedValue({ token: "jwt-token", user: authUser });

    const res = await POST(
      request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ user: authUser });
    expect(JSON.stringify(body)).not.toContain("jwt-token");
  });

  it("forwards the invite token and password to registerUser", async () => {
    registerUserMock.mockResolvedValue({ token: "jwt-token", user: authUser });

    await POST(request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }));

    expect(registerUserMock).toHaveBeenCalledWith(
      "52111603-53d7-4a99-a027-a105b4d527b5",
      "Pass.123",
    );
  });

  it("revalidates the users tag on success, so the newly registered user (and their Active status) shows up on next fetch", async () => {
    registerUserMock.mockResolvedValue({ token: "jwt-token", user: authUser });

    await POST(request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }));

    expect(revalidateTagMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("does not revalidate the users tag when registration fails", async () => {
    registerUserMock.mockRejectedValue(new ApimError("invalid or expired invite link", 400));

    await POST(request({ token: "bad-token", password: "Pass.123" }));

    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("sets the token as an httpOnly session cookie, never exposed to client JS", async () => {
    registerUserMock.mockResolvedValue({ token: "jwt-token", user: authUser });

    const res = await POST(
      request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }),
    );

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=jwt-token");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });

  it("sizes the cookie's maxAge to match the token's own exp claim, not a hardcoded guess", async () => {
    const now = Math.floor(Date.now() / 1000);
    const sessionToken = fakeJwt({ sub: "u1", role: "Customer Admin", exp: now + 3600 });
    registerUserMock.mockResolvedValue({ token: sessionToken, user: authUser });

    const res = await POST(
      request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }),
    );

    const maxAge = maxAgeFromSetCookie(res);
    expect(maxAge).not.toBeNull();
    expect(maxAge as number).toBeGreaterThan(3590);
    expect(maxAge as number).toBeLessThanOrEqual(3600);
  });

  it("falls back to a conservative default maxAge when the token has no decodable exp", async () => {
    registerUserMock.mockResolvedValue({ token: "not-a-real-jwt", user: authUser });

    const res = await POST(
      request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }),
    );

    expect(maxAgeFromSetCookie(res)).toBe(60 * 60 * 12);
  });

  it("forwards the APIM error message and status for an invalid/expired invite link", async () => {
    registerUserMock.mockRejectedValue(new ApimError("invalid or expired invite link", 400));

    const res = await POST(request({ token: "bad-token", password: "Pass.123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "invalid or expired invite link" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    registerUserMock.mockRejectedValue(new Error("boom"));

    const res = await POST(
      request({ token: "52111603-53d7-4a99-a027-a105b4d527b5", password: "Pass.123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Registration failed. Please try again.");
  });

  it("rejects missing token/password with 400 before calling registerUser", async () => {
    const res = await POST(request({ token: "", password: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Token and password are required.");
    expect(registerUserMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new Request("http://localhost/api/registeruser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Malformed request body.");
  });
});
