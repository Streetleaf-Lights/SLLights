import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionToken, getSecondsUntilExpiry } from "@sllights/shared/auth-role";
import type { SessionUser } from "@sllights/shared/types";
import { getRequestToken } from "@/lib/request-auth";

export type RequestSession =
  | { ok: true; token: string; session: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Resolves the caller for a /api/mobile/* handler, or the 401 to return.
 * Unlike the page routes (guarded by proxy.ts), API routes are excluded from
 * the proxy matcher, so each one has to establish the session itself.
 */
export function requireSession(request: NextRequest): RequestSession {
  const token = getRequestToken(request);
  const session = token ? decodeSessionToken(token) : null;
  if (!token || !session || getSecondsUntilExpiry(token) === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated. Please sign in again." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, token, session };
}
