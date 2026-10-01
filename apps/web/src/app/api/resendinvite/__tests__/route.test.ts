import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { resendInviteMock } = vi.hoisted(() => ({
  resendInviteMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    resendInvite: resendInviteMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/resendinvite/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/resendinvite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/resendinvite", () => {
  afterEach(() => {
    resendInviteMock.mockReset();
  });

  it("rejects a request with no session cookie with 401 before calling resendInvite", async () => {
    const res = await POST(request({ userId: "user1" }, { withSession: false }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(resendInviteMock).not.toHaveBeenCalled();
  });

  it("forwards userId and the session token to resendInvite, returning success", async () => {
    resendInviteMock.mockResolvedValue(undefined);

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(resendInviteMock).toHaveBeenCalledWith("user1", "jwt-token");
  });

  it("rejects a request missing userId with 400 before calling resendInvite", async () => {
    const res = await POST(request({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userId is required.");
    expect(resendInviteMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/resendinvite", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "session=jwt-token" },
      body: "not json",
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Malformed request body.");
  });

  it("forwards the APIM error message and status on failure", async () => {
    resendInviteMock.mockRejectedValue(new ApimError("user not found", 404));

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "user not found" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    resendInviteMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Resend invite failed. Please try again.");
  });
});
