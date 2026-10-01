import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function encodePayload(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function fakeJwt(payload: Record<string, unknown>): string {
  return `header.${encodePayload(payload)}.signature`;
}

function request(path: string, { sessionToken }: { sessionToken?: string } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    headers: sessionToken ? { cookie: `session=${sessionToken}` } : {},
  });
}

function isRedirectTo(response: Response, path: string): boolean {
  return response.status === 307 && new URL(response.headers.get("location")!).pathname === path;
}

function isPassthrough(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

const customerAdminToken = fakeJwt({
  sub: "1445C5D1-37C2-43CF-9F82-6223F425B265",
  role: "Customer Admin",
  customerId: "rec5uaHZMOGZGyVcY",
});

const customerOwnerToken = fakeJwt({
  sub: "2C7E2A44-6C0D-4A2B-9E31-9A2B7D4C1F0E",
  role: "Customer Owner",
  customerId: "rec5uaHZMOGZGyVcY",
});

const customerUserToken = fakeJwt({
  sub: "8DAE9C34-2C0A-4B5A-9F1D-3E7C8B6A1F02",
  role: "User",
  customerId: "rec5uaHZMOGZGyVcY",
});

const streetleafAdminToken = fakeJwt({
  sub: "6496D8A1-7A59-4673-9C29-BB522B94CD28",
  role: "Streetleaf Admin",
  customerId: null,
});

const streetleafUserToken = fakeJwt({
  sub: "F1A2B3C4-D5E6-47F8-A9B0-C1D2E3F4A5B6",
  role: "User",
  customerId: null,
});

describe("proxy", () => {
  it("lets /signin through with no session", () => {
    const res = proxy(request("/signin"));
    expect(isPassthrough(res)).toBe(true);
  });

  it("lets /register through with no session", () => {
    const res = proxy(request("/register"));
    expect(isPassthrough(res)).toBe(true);
  });

  it("lets /forgot-password through with no session", () => {
    const res = proxy(request("/forgot-password"));
    expect(isPassthrough(res)).toBe(true);
  });

  it("lets /reset-password through with no session", () => {
    const res = proxy(request("/reset-password"));
    expect(isPassthrough(res)).toBe(true);
  });

  it("redirects to /signin when there is no session cookie", () => {
    const res = proxy(request("/customers"));
    expect(isRedirectTo(res, "/signin")).toBe(true);
  });

  it("redirects to /signin when the session cookie is malformed", () => {
    const res = proxy(request("/customers", { sessionToken: "not-a-real-jwt" }));
    expect(isRedirectTo(res, "/signin")).toBe(true);
  });

  it("lets a Streetleaf Admin through to /customers", () => {
    const res = proxy(request("/customers", { sessionToken: streetleafAdminToken }));
    expect(isPassthrough(res)).toBe(true);
  });

  it("lets a Streetleaf Admin through to any customer's detail page", () => {
    const res = proxy(
      request("/customers/some-other-customer/projects/p1", {
        sessionToken: streetleafAdminToken,
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("redirects a Customer Admin away from the Customers list", () => {
    const res = proxy(request("/customers", { sessionToken: customerAdminToken }));
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("redirects a Customer Admin away from another customer's detail page", () => {
    const res = proxy(
      request("/customers/some-other-customer/projects/p1", {
        sessionToken: customerAdminToken,
      }),
    );
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("lets a Customer Admin through to their own customer's detail page", () => {
    const res = proxy(
      request("/customers/rec5uaHZMOGZGyVcY/projects/p1", { sessionToken: customerAdminToken }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("lets a Customer Admin through to their own customer's pole detail page", () => {
    const res = proxy(
      request("/customers/rec5uaHZMOGZGyVcY/projects/p1/poles/pole1", {
        sessionToken: customerAdminToken,
      }),
    );
    expect(isPassthrough(res)).toBe(true);
  });

  it("redirects a Customer Owner away from the Customers list, and scopes them to their own customer — same as a Customer Admin", () => {
    const listRes = proxy(request("/customers", { sessionToken: customerOwnerToken }));
    expect(isRedirectTo(listRes, "/projects")).toBe(true);

    const otherRes = proxy(
      request("/customers/some-other-customer/projects/p1", { sessionToken: customerOwnerToken }),
    );
    expect(isRedirectTo(otherRes, "/projects")).toBe(true);

    const ownRes = proxy(
      request("/customers/rec5uaHZMOGZGyVcY/projects/p1", { sessionToken: customerOwnerToken }),
    );
    expect(isPassthrough(ownRes)).toBe(true);
  });

  it("sends a signed-in Customer Admin from / to /projects", () => {
    const res = proxy(request("/", { sessionToken: customerAdminToken }));
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("lets a Customer Admin through to /poles and /users", () => {
    expect(isPassthrough(proxy(request("/poles", { sessionToken: customerAdminToken })))).toBe(
      true,
    );
    expect(isPassthrough(proxy(request("/users", { sessionToken: customerAdminToken })))).toBe(
      true,
    );
  });

  it("lets a Customer Admin through to /projects", () => {
    const res = proxy(request("/projects", { sessionToken: customerAdminToken }));
    expect(isPassthrough(res)).toBe(true);
  });

  it("redirects a Customer User (role User, with a customerId) away from the Customers list, same as a Customer Admin", () => {
    const res = proxy(request("/customers", { sessionToken: customerUserToken }));
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("redirects a Customer User away from another customer's detail page", () => {
    const res = proxy(
      request("/customers/some-other-customer/projects/p1", {
        sessionToken: customerUserToken,
      }),
    );
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("lets a Customer User through to their own customer's detail page, /projects, /poles, and /users", () => {
    expect(
      isPassthrough(
        proxy(
          request("/customers/rec5uaHZMOGZGyVcY/projects/p1", {
            sessionToken: customerUserToken,
          }),
        ),
      ),
    ).toBe(true);
    expect(isPassthrough(proxy(request("/projects", { sessionToken: customerUserToken })))).toBe(
      true,
    );
    expect(isPassthrough(proxy(request("/poles", { sessionToken: customerUserToken })))).toBe(
      true,
    );
    expect(isPassthrough(proxy(request("/users", { sessionToken: customerUserToken })))).toBe(
      true,
    );
  });

  it("sends a signed-in Customer User from / to /projects, same as a Customer Admin", () => {
    const res = proxy(request("/", { sessionToken: customerUserToken }));
    expect(isRedirectTo(res, "/projects")).toBe(true);
  });

  it("redirects a Streetleaf User (role User, no customerId) away from /projects, same as a Streetleaf Admin", () => {
    const res = proxy(request("/projects", { sessionToken: streetleafUserToken }));
    expect(isRedirectTo(res, "/customers")).toBe(true);
  });

  it("lets a Streetleaf User through to /customers", () => {
    const res = proxy(request("/customers", { sessionToken: streetleafUserToken }));
    expect(isPassthrough(res)).toBe(true);
  });

  it("redirects a Streetleaf Admin away from /projects", () => {
    const res = proxy(request("/projects", { sessionToken: streetleafAdminToken }));
    expect(isRedirectTo(res, "/customers")).toBe(true);
  });
});
