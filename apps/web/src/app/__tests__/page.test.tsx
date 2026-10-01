import { describe, expect, it, vi } from "vitest";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";

const { getSessionUserMock } = vi.hoisted(() => ({ getSessionUserMock: vi.fn() }));

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return {
    ...actual,
    getSessionUser: getSessionUserMock,
  };
});

import Home from "@/app/page";

async function redirectTargetOf(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
  } catch (err) {
    if (isRedirectError(err)) {
      const url = getURLFromRedirectError(err);
      return url ? new URL(url, "http://localhost").pathname : null;
    }
    throw err;
  }
  return null;
}

describe("Home (root page)", () => {
  it("redirects to /customers when no session is present", async () => {
    getSessionUserMock.mockResolvedValue(null);

    expect(await redirectTargetOf(() => Home())).toBe("/customers");
  });

  it("redirects to /customers for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });

    expect(await redirectTargetOf(() => Home())).toBe("/customers");
  });

  it("redirects to /poles for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });

    expect(await redirectTargetOf(() => Home())).toBe("/projects");
  });
});
