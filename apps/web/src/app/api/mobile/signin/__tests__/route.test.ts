import { afterEach, describe, expect, it, vi } from "vitest";

const { signInMock } = vi.hoisted(() => ({ signInMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, signIn: signInMock };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/mobile/signin/route";

function request(body: unknown) {
  return new Request("http://localhost/api/mobile/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const user = { id: "u1", name: "Crew One", email: "crew@streetleaf.com", role: "User", customerId: null };

describe("POST /api/mobile/signin", () => {
  afterEach(() => signInMock.mockReset());

  it("returns the token and user in the body and sets no cookie", async () => {
    signInMock.mockResolvedValue({ token: "jwt", user });

    const res = await POST(request({ email: "crew@streetleaf.com", password: "pw" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: "jwt", user });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(signInMock).toHaveBeenCalledWith("crew@streetleaf.com", "pw");
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(request("{not json"));
    expect(res.status).toBe(400);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("rejects missing credentials with 400", async () => {
    const res = await POST(request({ email: "crew@streetleaf.com", password: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Email and password are required.");
  });

  it("passes APIM's error message and status through", async () => {
    signInMock.mockRejectedValue(new ApimError("invalid email or password", 401));
    const res = await POST(request({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid email or password");
  });

  it("returns a generic 500 for unexpected failures", async () => {
    signInMock.mockRejectedValue(new Error("boom"));
    const res = await POST(request({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Sign in failed. Please try again.");
  });
});
