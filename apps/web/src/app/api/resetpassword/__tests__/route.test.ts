import { afterEach, describe, expect, it, vi } from "vitest";

const { resetPasswordMock } = vi.hoisted(() => ({ resetPasswordMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    resetPassword: resetPasswordMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/resetpassword/route";

function request(body: unknown) {
  return new Request("http://localhost/api/resetpassword", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/resetpassword", () => {
  afterEach(() => {
    resetPasswordMock.mockReset();
  });

  it("forwards the token and newPassword to resetPassword and returns the result", async () => {
    resetPasswordMock.mockResolvedValue({ success: true });

    const res = await POST(
      request({ token: "b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", newPassword: "Pass.123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(resetPasswordMock).toHaveBeenCalledWith(
      "b442b6bd-4fb5-4d54-9cc3-aedc9ae76603",
      "Pass.123",
    );
  });

  it("rejects missing token/newPassword with 400 before calling resetPassword", async () => {
    const res = await POST(request({ token: "", newPassword: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Token and new password are required.");
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new Request("http://localhost/api/resetpassword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Malformed request body.");
  });

  it("forwards the APIM error message and status for an invalid/expired reset link", async () => {
    resetPasswordMock.mockRejectedValue(new ApimError("invalid or expired reset link", 400));

    const res = await POST(
      request({ token: "bad-token", newPassword: "Pass.123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "invalid or expired reset link" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    resetPasswordMock.mockRejectedValue(new Error("boom"));

    const res = await POST(
      request({ token: "b442b6bd-4fb5-4d54-9cc3-aedc9ae76603", newPassword: "Pass.123" }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Reset failed. Please try again.");
  });
});
