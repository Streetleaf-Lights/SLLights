import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { fetchLeadsunLampStatusMock } = vi.hoisted(() => ({
  fetchLeadsunLampStatusMock: vi.fn(),
}));

vi.mock("@/lib/leadsunClient", () => ({
  fetchLeadsunLampStatus: fetchLeadsunLampStatusMock,
}));

import { GET } from "@/app/api/leadsunlampstatus/route";

function request(params: Record<string, string>, cookie?: string) {
  const url = new URL("http://localhost/api/leadsunlampstatus");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const req = new NextRequest(url);
  if (cookie) {
    req.cookies.set("session", cookie);
  }
  return req;
}

describe("GET /api/leadsunlampstatus", () => {
  afterEach(() => {
    fetchLeadsunLampStatusMock.mockReset();
  });

  it("returns 401 when there's no session cookie", async () => {
    const res = await GET(request({ projectId: "389" }));
    expect(res.status).toBe(401);
    expect(fetchLeadsunLampStatusMock).not.toHaveBeenCalled();
  });

  it("returns 400 when projectId is missing", async () => {
    const res = await GET(request({}, "valid-token"));
    expect(res.status).toBe(400);
    expect(fetchLeadsunLampStatusMock).not.toHaveBeenCalled();
  });

  it("calls fetchLeadsunLampStatus with just projectId when productId is omitted", async () => {
    fetchLeadsunLampStatusMock.mockResolvedValue([]);
    await GET(request({ projectId: "389" }, "valid-token"));

    expect(fetchLeadsunLampStatusMock).toHaveBeenCalledWith("389", undefined);
  });

  it("calls fetchLeadsunLampStatus with both projectId and productId when both are given", async () => {
    fetchLeadsunLampStatusMock.mockResolvedValue([]);
    await GET(request({ projectId: "389", productId: "AEXSAM2324122936" }, "valid-token"));

    expect(fetchLeadsunLampStatusMock).toHaveBeenCalledWith("389", "AEXSAM2324122936");
  });

  it("returns the lamp status array as JSON on success", async () => {
    const lamps = [
      {
        productId: "AEXSAM2324122936",
        productName: "DRH-Orl",
        lampPower1: 0,
        lampPower2: 0,
        isOnline: true,
        lastUpload: "2026-09-03T14:39:41.520+00:00",
      },
    ];
    fetchLeadsunLampStatusMock.mockResolvedValue(lamps);

    const res = await GET(request({ projectId: "389" }, "valid-token"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(lamps);
  });

  it("sets Cache-Control: no-store on a successful response — this reflects a pole's current physical state, so a stale cached answer would be actively wrong, not just outdated", async () => {
    fetchLeadsunLampStatusMock.mockResolvedValue([]);
    const res = await GET(request({ projectId: "389" }, "valid-token"));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Cache-Control: no-store on the 401 (no session) response too", async () => {
    const res = await GET(request({ projectId: "389" }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Cache-Control: no-store on the 400 (missing projectId) response too", async () => {
    const res = await GET(request({}, "valid-token"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Cache-Control: no-store on the 502 (upstream failure) response too", async () => {
    fetchLeadsunLampStatusMock.mockRejectedValue(new Error("mTLS handshake failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request({ projectId: "389" }, "valid-token"));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 502 (not a crash) when fetchLeadsunLampStatus throws, and includes the real reason in 'detail'", async () => {
    fetchLeadsunLampStatusMock.mockRejectedValue(new Error("mTLS handshake failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request({ projectId: "389" }, "valid-token"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(body.detail).toBe("mTLS handshake failed");
    // The real reason must be logged server-side, not just in the response
    // body, since that's the only trace of it once returned to the client.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "GET /api/leadsunlampstatus failed:",
      "mTLS handshake failed",
    );

    consoleErrorSpy.mockRestore();
  });

  it("still returns a detail string when a non-Error value is thrown", async () => {
    fetchLeadsunLampStatusMock.mockRejectedValue("plain string rejection");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request({ projectId: "389" }, "valid-token"));
    const body = await res.json();
    expect(body.detail).toBe("plain string rejection");
  });
});
