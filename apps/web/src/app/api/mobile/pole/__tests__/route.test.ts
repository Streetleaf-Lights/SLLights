import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getPolesMock } = vi.hoisted(() => ({ getPolesMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getPoles: getPolesMock };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/mobile/pole/route";

const future = Math.floor(Date.now() / 1000) + 3600;
const adminToken = testToken({ sub: "a1", role: "Streetleaf Admin", exp: future });
const customerToken = testToken({ sub: "u1", role: "Customer Admin", customerId: "c1", exp: future });

function request(poleNumber: string | null, token: string | null = adminToken) {
  const url = new URL("http://localhost/api/mobile/pole");
  if (poleNumber !== null) url.searchParams.set("poleNumber", poleNumber);
  return new NextRequest(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
}

const pole = (poleNumber: string, customerId: string) => ({ id: poleNumber, poleNumber, customerId, projectId: "p1" });

describe("GET /api/mobile/pole", () => {
  afterEach(() => getPolesMock.mockReset());

  it("401s without a token, before calling APIM", async () => {
    const res = await GET(request("PAS-1", null));
    expect(res.status).toBe(401);
    expect(getPolesMock).not.toHaveBeenCalled();
  });

  it("401s for an undecodable or expired token", async () => {
    expect((await GET(request("PAS-1", "garbage"))).status).toBe(401);
    const expired = testToken({ sub: "a1", role: "Streetleaf Admin", exp: 1 });
    expect((await GET(request("PAS-1", expired))).status).toBe(401);
    expect(getPolesMock).not.toHaveBeenCalled();
  });

  it("400s for a missing or invalid poleNumber", async () => {
    expect((await GET(request(null))).status).toBe(400);
    expect((await GET(request("not a pole"))).status).toBe(400);
  });

  it("searches all poles for a cross-customer user and matches case-insensitively", async () => {
    getPolesMock.mockResolvedValue([pole("PAS-1", "c9"), pole("PAS-2", "c9")]);

    const res = await GET(request("pas-2"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pole: pole("PAS-2", "c9") });
    expect(getPolesMock).toHaveBeenCalledWith(undefined, adminToken);
  });

  it("scopes a customer-scoped user's search to their own customer", async () => {
    getPolesMock.mockResolvedValue([pole("PAS-1", "c1")]);

    const res = await GET(request("PAS-1", customerToken));

    expect(await res.json()).toEqual({ pole: pole("PAS-1", "c1") });
    expect(getPolesMock).toHaveBeenCalledWith({ customerId: "c1" }, customerToken);
  });

  it("hides another customer's pole even if APIM ignored the filter", async () => {
    getPolesMock.mockResolvedValue([pole("PAS-1", "c2")]);
    const res = await GET(request("PAS-1", customerToken));
    expect(await res.json()).toEqual({ pole: null });
  });

  it("returns pole: null when nothing matches", async () => {
    getPolesMock.mockResolvedValue([pole("PAS-1", "c9")]);
    expect(await (await GET(request("PAS-404"))).json()).toEqual({ pole: null });
  });

  it("passes APIM errors through and hides unexpected ones", async () => {
    getPolesMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    const apimRes = await GET(request("PAS-1"));
    expect(apimRes.status).toBe(503);

    getPolesMock.mockRejectedValueOnce(new Error("socket hang up"));
    const otherRes = await GET(request("PAS-1"));
    expect(otherRes.status).toBe(500);
    expect((await otherRes.json()).error).toBe("Pole lookup failed. Please try again.");
  });
});
