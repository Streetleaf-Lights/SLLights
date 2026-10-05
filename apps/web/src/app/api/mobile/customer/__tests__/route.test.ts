import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { getCustomerMock } = vi.hoisted(() => ({ getCustomerMock: vi.fn() }));

vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, getCustomer: getCustomerMock };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/mobile/customer/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const customerToken = testToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp });
const staffToken = testToken({ sub: "a1", role: "Streetleaf Admin", exp });

function request(token: string | null, query = "") {
  return new NextRequest(`http://localhost/api/mobile/customer${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const customer = { id: "c1", name: "Coastal Power", projects: [], address: "1 Main St", city: null, state: null, zip: null, phone: "555", active: true };

describe("GET /api/mobile/customer", () => {
  afterEach(() => getCustomerMock.mockReset());

  it("401s without a token", async () => {
    expect((await GET(request(null))).status).toBe(401);
    expect(getCustomerMock).not.toHaveBeenCalled();
  });

  it("returns only id and name of the caller's own customer", async () => {
    getCustomerMock.mockResolvedValue(customer);

    const res = await GET(request(customerToken));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ customer: { id: "c1", name: "Coastal Power" } });
    expect(getCustomerMock).toHaveBeenCalledWith("c1", customerToken);
  });

  it("ignores any customerId in the query string", async () => {
    getCustomerMock.mockResolvedValue(customer);
    await GET(request(customerToken, "?customerId=c2"));
    expect(getCustomerMock).toHaveBeenCalledWith("c1", customerToken);
  });

  it("returns null for Streetleaf staff without calling APIM", async () => {
    const res = await GET(request(staffToken));
    expect(await res.json()).toEqual({ customer: null });
    expect(getCustomerMock).not.toHaveBeenCalled();
  });

  it("returns null when the customer record isn't found", async () => {
    getCustomerMock.mockResolvedValue(undefined);
    expect(await (await GET(request(customerToken))).json()).toEqual({ customer: null });
  });

  it("passes APIM errors through and hides unexpected ones", async () => {
    getCustomerMock.mockRejectedValueOnce(new ApimError("APIM request failed", 503));
    expect((await GET(request(customerToken))).status).toBe(503);

    getCustomerMock.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(request(customerToken));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Couldn't load your customer. Please try again.");
  });
});
