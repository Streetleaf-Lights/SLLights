import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    signOut: signOutMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/signout/route";

function request({ withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/signout", {
    method: "POST",
    headers: withSession ? { cookie: "session=jwt-token" } : {},
  });
}

describe("POST /api/signout", () => {
  afterEach(() => {
    signOutMock.mockReset();
  });

  it("short-circuits to success with no session cookie, without calling signOut", async () => {
    const res = await POST(request({ withSession: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("calls signOut with the session token", async () => {
    signOutMock.mockResolvedValue(undefined);

    await POST(request());

    expect(signOutMock).toHaveBeenCalledWith("jwt-token");
  });

  it("clears the session cookie on success", async () => {
    signOutMock.mockResolvedValue(undefined);

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=;");
  });

  it("treats an already-expired/invalid token (401) as already signed out — clears the cookie and returns success", async () => {
    signOutMock.mockRejectedValue(new ApimError("session expired, please sign in again", 401));

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=;");
  });

  it("treats a 403 (forbidden/invalid token) the same way — clears the cookie and returns success", async () => {
    signOutMock.mockRejectedValue(new ApimError("invalid token", 403));

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it("forwards the APIM error message and status for a genuine failure (not 401/403), without clearing the cookie", async () => {
    signOutMock.mockRejectedValue(new ApimError("APIM is temporarily unavailable", 503));

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ error: "APIM is temporarily unavailable" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    signOutMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Sign out failed. Please try again.");
  });
});
