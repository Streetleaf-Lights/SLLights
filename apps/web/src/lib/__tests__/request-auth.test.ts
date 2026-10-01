import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getRequestToken } from "@/lib/request-auth";

function request(headers: Record<string, string>) {
  return new NextRequest("http://localhost/api/anything", { headers });
}

describe("getRequestToken", () => {
  it("reads a Bearer token from the Authorization header", () => {
    expect(getRequestToken(request({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
    expect(getRequestToken(request({ authorization: "bearer abc" }))).toBe("abc");
  });

  it("falls back to the session cookie", () => {
    expect(getRequestToken(request({ cookie: "session=cookie-token" }))).toBe("cookie-token");
  });

  it("prefers the header when both are present", () => {
    expect(
      getRequestToken(request({ authorization: "Bearer header-token", cookie: "session=cookie-token" })),
    ).toBe("header-token");
  });

  it("ignores non-Bearer or malformed Authorization headers", () => {
    expect(getRequestToken(request({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
    expect(getRequestToken(request({ authorization: "Bearer" }))).toBeNull();
    expect(getRequestToken(request({ authorization: "Bearer a b" }))).toBeNull();
    expect(getRequestToken(request({}))).toBeNull();
  });
});
