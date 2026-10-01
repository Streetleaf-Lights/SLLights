import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { setPoleLightsMock } = vi.hoisted(() => ({
  setPoleLightsMock: vi.fn(),
}));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    setPoleLights: setPoleLightsMock,
  };
});

import { ApimError } from "@/lib/apim";
import { POST } from "@/app/api/setpolelights/route";

/** By default carries a session cookie, matching an authenticated request. */
function request(body: unknown, { withSession = true }: { withSession?: boolean } = {}) {
  return new NextRequest("http://localhost/api/setpolelights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSession ? { cookie: "session=jwt-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}

const successBody = {
  success: true,
  message: "Request successful",
  statusCode: "200",
  data: null,
};

describe("POST /api/setpolelights", () => {
  afterEach(() => {
    setPoleLightsMock.mockReset();
  });

  it("rejects a request with no session cookie with 401 before calling setPoleLights", async () => {
    const res = await POST(
      request({ projectId: "rec1", brightness: 50, time: 30 }, { withSession: false }),
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated. Please sign in again.");
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("forwards projectId/brightness/time and the session token, returning the server's response", async () => {
    setPoleLightsMock.mockResolvedValue(successBody);

    const res = await POST(request({ projectId: "rec1", brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(successBody);
    expect(setPoleLightsMock).toHaveBeenCalledWith(
      { projectId: "rec1", brightness: 50, time: 30 },
      "jwt-token",
    );
  });

  it("forwards gatewayCode/brightness/time for a gateway-level request", async () => {
    setPoleLightsMock.mockResolvedValue(successBody);

    await POST(request({ gatewayCode: "GT13L94A2506283D", brightness: 50, time: 30 }));

    expect(setPoleLightsMock).toHaveBeenCalledWith(
      { gatewayCode: "GT13L94A2506283D", brightness: 50, time: 30 },
      "jwt-token",
    );
  });

  it("forwards poleNumber/brightness/time for a pole-level request", async () => {
    setPoleLightsMock.mockResolvedValue(successBody);

    await POST(request({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }));

    expect(setPoleLightsMock).toHaveBeenCalledWith(
      { poleNumber: "DRH-Orl", brightness: 50, time: 30 },
      "jwt-token",
    );
  });

  it("rejects a request missing brightness/time with 400 before calling setPoleLights", async () => {
    const res = await POST(request({ projectId: "rec1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("brightness and time are required numbers.");
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("rejects a request with none of projectId/gatewayCode/poleNumber/poleNumbers with 400", async () => {
    const res = await POST(request({ brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      "Exactly one of projectId, gatewayCode, poleNumber, or poleNumbers is required.",
    );
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("rejects a request with more than one of projectId/gatewayCode/poleNumber/poleNumbers with 400", async () => {
    const res = await POST(
      request({ projectId: "rec1", gatewayCode: "GW1", brightness: 50, time: 30 }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      "Exactly one of projectId, gatewayCode, poleNumber, or poleNumbers is required.",
    );
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("forwards poleNumbers/brightness/time for a selected-poles request", async () => {
    setPoleLightsMock.mockResolvedValue(successBody);

    await POST(request({ poleNumbers: ["DRH-Orl", "DUKE-AVE"], brightness: 50, time: 30 }));

    expect(setPoleLightsMock).toHaveBeenCalledWith(
      { poleNumbers: ["DRH-Orl", "DUKE-AVE"], brightness: 50, time: 30 },
      "jwt-token",
    );
  });

  it("rejects an empty poleNumbers array with 400, rather than treating it as a valid scope", async () => {
    const res = await POST(request({ poleNumbers: [], brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      "Exactly one of projectId, gatewayCode, poleNumber, or poleNumbers is required.",
    );
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("rejects a poleNumbers array containing a non-string entry with 400", async () => {
    const res = await POST(request({ poleNumbers: ["DRH-Orl", 5], brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(
      "Exactly one of projectId, gatewayCode, poleNumber, or poleNumbers is required.",
    );
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("rejects a request with both poleNumber and poleNumbers with 400", async () => {
    const res = await POST(
      request({ poleNumber: "DRH-Orl", poleNumbers: ["DUKE-AVE"], brightness: 50, time: 30 }),
    );

    expect(res.status).toBe(400);
    expect(setPoleLightsMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with 400", async () => {
    const badRequest = new NextRequest("http://localhost/api/setpolelights", {
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    setPoleLightsMock.mockRejectedValue(new ApimError("Pole is offline", 409));

    const res = await POST(request({ poleNumber: "DRH-Orl", brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Pole is offline" });
  });

  it("logs the real error server-side for an ApimError failure — otherwise a 502 from APIM/a gateway in front of it is completely undebuggable", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setPoleLightsMock.mockRejectedValue(
      new ApimError("Set pole lights failed (502): <html>Bad Gateway</html>", 502),
    );

    await POST(request({ projectId: "rec1", brightness: 50, time: 30 }));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "POST /api/setpolelights failed:",
      "Set pole lights failed (502): <html>Bad Gateway</html>",
      "status:",
      502,
    );
    consoleErrorSpy.mockRestore();
  });

  it("returns a generic 500 for unexpected non-ApimError failures, and includes the real reason in 'detail'", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setPoleLightsMock.mockRejectedValue(new Error("boom"));

    const res = await POST(request({ projectId: "rec1", brightness: 50, time: 30 }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Set pole lights failed. Please try again.");
    expect(body.detail).toBe("boom");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "POST /api/setpolelights failed (unexpected):",
      "boom",
    );
    consoleErrorSpy.mockRestore();
  });

  it("still returns a detail string when a non-Error value is thrown unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setPoleLightsMock.mockRejectedValue("plain string rejection");

    const res = await POST(request({ projectId: "rec1", brightness: 50, time: 30 }));
    const body = await res.json();

    expect(body.detail).toBe("plain string rejection");
  });
});
