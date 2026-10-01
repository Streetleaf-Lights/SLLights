import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { inviteUserMock, revalidateTagMock } = vi.hoisted(() => ({
  inviteUserMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    inviteUser: inviteUserMock,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/inviteuser/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/inviteuser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/inviteuser", () => {
  afterEach(() => {
    inviteUserMock.mockReset();
    revalidateTagMock.mockReset();
  });

  const successBody = {
    userId: "8714b64b-1186-487a-820a-6ee0c53a2b25",
    email: "minh+9@streetleaf.com",
    emailSent: true,
  };

  it("rejects a request with no session cookie with 401 before calling inviteUser", async () => {
    const res = await POST(
      request(
        { name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" },
        { withSession: false },
      ),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it("forwards name/email/role and the session token to inviteUser, returning the result on success", async () => {
    inviteUserMock.mockResolvedValue(successBody);

    const res = await POST(
      request({ name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(successBody);
    expect(inviteUserMock).toHaveBeenCalledWith(
      {
        name: "Minh Tran",
        email: "minh@streetleaf.com",
        role: "Streetleaf Admin",
        customerId: undefined,
      },
      "jwt-token",
    );
  });

  it("revalidates the users tag on success, so the users list is fresh on next fetch", async () => {
    inviteUserMock.mockResolvedValue(successBody);

    await POST(
      request({ name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" }),
    );

    expect(revalidateTagMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("does not revalidate the users tag when the invite fails", async () => {
    inviteUserMock.mockRejectedValue(new ApimError("email already invited", 409));

    await POST(
      request({ name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" }),
    );

    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("forwards customerId when provided", async () => {
    inviteUserMock.mockResolvedValue(successBody);

    await POST(
      request({
        name: "Jane Doe",
        email: "jane@example.com",
        role: "Customer Admin",
        customerId: "cust-2",
      }),
    );

    expect(inviteUserMock).toHaveBeenCalledWith(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        role: "Customer Admin",
        customerId: "cust-2",
      },
      "jwt-token",
    );
  });

  it("rejects a request missing name/email/role with 400 before calling inviteUser", async () => {
    const res = await POST(request({ name: "", email: "", role: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Name, email, and role are required.");
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string customerId with 400", async () => {
    const res = await POST(
      request({
        name: "Jane Doe",
        email: "jane@example.com",
        role: "Customer Admin",
        customerId: 123,
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("customerId must be a string.");
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/inviteuser", {
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
    inviteUserMock.mockRejectedValue(new ApimError("email already invited", 409));

    const res = await POST(
      request({ name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "email already invited" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    inviteUserMock.mockRejectedValue(new Error("boom"));

    const res = await POST(
      request({ name: "Minh Tran", email: "minh@streetleaf.com", role: "Streetleaf Admin" }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Invite failed. Please try again.");
  });
});
