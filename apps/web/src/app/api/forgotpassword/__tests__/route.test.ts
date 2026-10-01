import { afterEach, describe, expect, it, vi } from "vitest";

const { forgotPasswordMock } = vi.hoisted(() => ({ forgotPasswordMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    forgotPassword: forgotPasswordMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/forgotpassword/route";

function request(body: unknown) {
  return new Request("http://localhost/api/forgotpassword", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/forgotpassword", () => {
  afterEach(() => {
    forgotPasswordMock.mockReset();
  });

  const successBody = { message: "If that email exists, a reset link has been sent." };

  it("forwards the trimmed email to forgotPassword and returns its message", async () => {
    forgotPasswordMock.mockResolvedValue(successBody);

    const res = await POST(request({ email: "  minh+4@streetleaf.com  " }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(successBody);
    expect(forgotPasswordMock).toHaveBeenCalledWith("minh+4@streetleaf.com");
  });

  it("rejects a missing/empty email with 400 before calling forgotPassword", async () => {
    const res = await POST(request({ email: "" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Email is required.");
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new Request("http://localhost/api/forgotpassword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(badRequest);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Malformed request body.");
  });

  it("forwards the APIM error message and status on failure", async () => {
    forgotPasswordMock.mockRejectedValue(new ApimError("malformed email", 400));

    const res = await POST(request({ email: "not-an-email" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "malformed email" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    forgotPasswordMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request({ email: "minh+4@streetleaf.com" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Something went wrong. Please try again.");
  });
});
