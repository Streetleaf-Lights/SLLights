import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { changeRoleMock, revalidateTagMock } = vi.hoisted(() => ({
  changeRoleMock: vi.fn(),
  revalidateTagMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    changeRole: changeRoleMock,
  };
});

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/changerole/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/changerole", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/changerole", () => {
  afterEach(() => {
    changeRoleMock.mockReset();
    revalidateTagMock.mockReset();
  });

  it("rejects a request with no session cookie with 401 before calling changeRole", async () => {
    const res = await POST(request({ userId: "user1" }, { withSession: false }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it("forwards userId and the session token to changeRole, returning the updated user", async () => {
    changeRoleMock.mockResolvedValue({
      userId: "user1",
      role: "Customer Admin",
      customerId: "cust-1",
    });

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ userId: "user1", role: "Customer Admin", customerId: "cust-1" });
    expect(changeRoleMock).toHaveBeenCalledWith("user1", "jwt-token");
  });

  it("revalidates the users tag on success, so the Role column is fresh on next fetch", async () => {
    changeRoleMock.mockResolvedValue({
      userId: "user1",
      role: "Customer Admin",
      customerId: "cust-1",
    });

    await POST(request({ userId: "user1" }));

    expect(revalidateTagMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("does not revalidate the users tag when the change fails", async () => {
    changeRoleMock.mockRejectedValue(
      new ApimError("this action requires one of: Streetleaf Admin, Customer Admin", 400),
    );

    await POST(request({ userId: "user1" }));

    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("rejects a request missing userId with 400 before calling changeRole", async () => {
    const res = await POST(request({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("userId is required.");
    expect(changeRoleMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/changerole", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "session=jwt-token" },
      body: "not json",
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Malformed request body.");
  });

  it("forwards the APIM error message and status on failure (e.g. a non-admin caller)", async () => {
    changeRoleMock.mockRejectedValue(
      new ApimError("this action requires one of: Streetleaf Admin, Customer Admin", 400),
    );

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: "this action requires one of: Streetleaf Admin, Customer Admin",
    });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    changeRoleMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request({ userId: "user1" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Change role failed. Please try again.");
  });
});
