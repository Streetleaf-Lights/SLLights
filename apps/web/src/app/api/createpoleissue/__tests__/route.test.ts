import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createPoleIssueMock } = vi.hoisted(() => ({
  createPoleIssueMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    createPoleIssue: createPoleIssueMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/createpoleissue/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/createpoleissue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  poleNumber: "TESTSL1-1004",
  status: "Electrical Issue",
  problemDetails: "Testing pole issue creation",
};

describe("POST /api/createpoleissue", () => {
  afterEach(() => {
    createPoleIssueMock.mockReset();
  });

  it("rejects a request with no session cookie with 401 before calling createPoleIssue", async () => {
    const res = await POST(request(validBody, { withSession: false }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("forwards poleNumber, status, problemDetails and the session token to createPoleIssue, returning success", async () => {
    createPoleIssueMock.mockResolvedValue(undefined);

    const res = await POST(request(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(createPoleIssueMock).toHaveBeenCalledWith(
      {
        poleNumber: "TESTSL1-1004",
        status: "Electrical Issue",
        problemDetails: "Testing pole issue creation",
      },
      "jwt-token",
    );
  });

  it("rejects a request missing poleNumber with 400 before calling createPoleIssue", async () => {
    const res = await POST(request({ status: "Electrical Issue", problemDetails: "x" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("poleNumber is required.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("rejects a request with an empty poleNumber with 400", async () => {
    const res = await POST(request({ ...validBody, poleNumber: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("poleNumber is required.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("rejects a request missing status with 400 before calling createPoleIssue", async () => {
    const res = await POST(request({ poleNumber: "TESTSL1-1004", problemDetails: "x" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("status is required.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("rejects a request missing problemDetails with 400 before calling createPoleIssue", async () => {
    const res = await POST(request({ poleNumber: "TESTSL1-1004", status: "Electrical Issue" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("problemDetails is required.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("rejects a request with an empty problemDetails with 400", async () => {
    const res = await POST(request({ ...validBody, problemDetails: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("problemDetails is required.");
    expect(createPoleIssueMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/createpoleissue", {
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
    createPoleIssueMock.mockRejectedValue(new ApimError("pole not found", 404));

    const res = await POST(request(validBody));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "pole not found" });
  });

  it("returns a generic 500 for unexpected non-ApimError failures", async () => {
    createPoleIssueMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request(validBody));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to report the issue. Please try again.");
  });
});

describe("POST /api/createpoleissue (mobile bearer token)", () => {
  afterEach(() => {
    createPoleIssueMock.mockReset();
  });

  it("accepts an Authorization: Bearer token in place of the session cookie", async () => {
    createPoleIssueMock.mockResolvedValue(undefined);

    const res = await POST(
      new NextRequest("http://localhost/api/createpoleissue", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: "Bearer mobile-token" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(200);
    expect(createPoleIssueMock).toHaveBeenCalledWith(validBody, "mobile-token");
  });
});
