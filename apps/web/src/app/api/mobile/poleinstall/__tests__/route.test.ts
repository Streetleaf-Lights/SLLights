import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mobile/poleinstall/route";
import { testToken } from "@/testing/testToken";

const token = testToken({ sub: "u1", role: "User", exp: Math.floor(Date.now() / 1000) + 3600 });

function request(body: unknown, withToken = true) {
  return new NextRequest("http://localhost/api/mobile/poleinstall", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withToken ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  poleNumber: "PAS-4938",
  scannedValue: "PAS-4938",
  latitude: 27.95,
  longitude: -82.46,
  accuracyMeters: 5,
  capturedAt: "2026-10-01T12:00:00.000Z",
  notes: null,
};

describe("POST /api/mobile/poleinstall", () => {
  it("401s without a token", async () => {
    expect((await POST(request(valid, false))).status).toBe(401);
  });

  it("400s for a malformed body", async () => {
    expect((await POST(request("{nope"))).status).toBe(400);
  });

  it("400s with the shared validator's message for an invalid payload", async () => {
    const res = await POST(request({ ...valid, latitude: 200 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("latitude must be a number between -90 and 90.");
  });

  it("answers 501 for a valid payload until the APIM operation exists", async () => {
    const res = await POST(request(valid));
    expect(res.status).toBe(501);
    expect((await res.json()).error).toMatch(/isn't available yet/);
  });

  it("403s customer-scoped users, before validating anything", async () => {
    const customerToken = testToken({ sub: "c", role: "Customer Owner", customerId: "c1", exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = await POST(
      new NextRequest("http://localhost/api/mobile/poleinstall", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${customerToken}` },
        body: JSON.stringify(valid),
      }),
    );
    expect(res.status).toBe(403);
  });
});
