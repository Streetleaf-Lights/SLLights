import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { deleteUserMock } = vi.hoisted(() => ({ deleteUserMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return { ...actual, deleteUser: deleteUserMock };
});

import { DELETE as mobileDelete } from "@/app/api/mobile/account/route";
import { POST as webDelete } from "@/app/api/deleteaccount/route";
import { ApimError } from "@/lib/apim";

const exp = Math.floor(Date.now() / 1000) + 3600;
const tokenFor = (sub: string, role: string, customerId?: string) =>
  testToken({ sub, role, exp, ...(customerId ? { customerId } : {}) });

const mobileCall = (token: string | null, body?: unknown) =>
  mobileDelete(
    new NextRequest("http://localhost/api/mobile/account?userId=someone-else", {
      method: "DELETE",
      headers: token ? { authorization: `Bearer ${token}`, "content-type": "application/json" } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
const webCall = (token: string | null, body: unknown = {}) =>
  webDelete(
    new NextRequest("http://localhost/api/deleteaccount", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { cookie: `session=${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );

afterEach(() => deleteUserMock.mockReset());

describe("deleting your own account", () => {
  it.each([
    ["Streetleaf Crew", undefined],
    ["Streetleaf Admin", undefined],
    ["User", "c1"],
    ["Customer Admin", "c1"],
    ["Customer Owner", "c1"], // owners can delete themselves straight away
  ])("works for %s (app)", async (role, customerId) => {
    deleteUserMock.mockResolvedValue(undefined);
    const token = tokenFor("me-1", role, customerId);
    const res = await mobileCall(token);
    expect(res.status).toBe(200);
    expect(deleteUserMock).toHaveBeenCalledWith("me-1", token);
  });

  it("only ever deletes the caller, whatever the request names (app and web)", async () => {
    deleteUserMock.mockResolvedValue(undefined);
    await mobileCall(tokenFor("me-1", "User", "c1"), { userId: "victim-9", id: "victim-9" });
    await webCall(tokenFor("me-2", "Customer Admin", "c1"), { userId: "victim-9" });
    expect(deleteUserMock.mock.calls.map(([id]) => id)).toEqual(["me-1", "me-2"]);
  });

  it("signs the web user out by clearing the session cookie", async () => {
    deleteUserMock.mockResolvedValue(undefined);
    const res = await webCall(tokenFor("me-1", "Customer Owner", "c1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^session=;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  it("refuses requests without a valid session, deleting nothing", async () => {
    expect((await mobileCall(null)).status).toBe(401);
    expect((await webCall(null)).status).toBe(401);
    const expired = testToken({ sub: "me-1", role: "User", exp: Math.floor(Date.now() / 1000) - 60 });
    expect((await mobileCall(expired)).status).toBe(401);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("passes APIM's refusal back, keeping the session", async () => {
    deleteUserMock.mockRejectedValue(new ApimError("User cannot be deleted.", 409));
    const res = await webCall(tokenFor("me-1", "User", "c1"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("User cannot be deleted.");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("gives a plain message for unexpected failures", async () => {
    deleteUserMock.mockRejectedValue(new Error("socket hang up"));
    const res = await mobileCall(tokenFor("me-1", "User", "c1"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Couldn't delete your account. Please try again.");
  });
});
