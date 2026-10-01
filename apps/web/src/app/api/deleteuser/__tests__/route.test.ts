import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { deleteUserMock, revalidateTagMock } = vi.hoisted(() => ({
  deleteUserMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    deleteUser: deleteUserMock,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/deleteuser/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/deleteuser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/deleteuser", () => {
  afterEach(() => {
    deleteUserMock.mockReset();
    revalidateTagMock.mockReset();
  });

  it("rejects a request with no session cookie with 401 before calling deleteUser", async () => {
    const res = await POST(request({ userId: "user1" }, { withSession: false }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("forwards userId and the session token to deleteUser, returning success", async () => {
    deleteUserMock.mockResolvedValue(undefined);

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(deleteUserMock).toHaveBeenCalledWith("user1", "jwt-token");
  });

  it("revalidates the users tag on success, so the users list is fresh on next fetch", async () => {
    deleteUserMock.mockResolvedValue(undefined);

    await POST(request({ userId: "user1" }));

    expect(revalidateTagMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("does not revalidate the users tag when the delete fails", async () => {
    deleteUserMock.mockRejectedValue(new ApimError("cannot delete the last admin", 409));

    await POST(request({ userId: "user1" }));

    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("rejects a request missing userId with 400 before calling deleteUser", async () => {
    const res = await POST(request({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userId is required.");
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/deleteuser", {
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
    deleteUserMock.mockRejectedValue(new ApimError("cannot delete the last admin", 409));

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "cannot delete the last admin" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    deleteUserMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Delete failed. Please try again.");
  });
});
