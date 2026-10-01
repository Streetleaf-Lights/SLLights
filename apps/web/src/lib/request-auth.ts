import type { NextRequest } from "next/server";

/**
 * The caller's session JWT for a Route Handler, from either:
 *  - an `Authorization: Bearer <token>` header (the mobile app, which keeps
 *    the token in the OS keychain and has no cookie jar), or
 *  - the httpOnly `session` cookie (the web app).
 *
 * The header wins when both are present: a native client sending one is
 * explicit about which identity it means. Accepting a bearer header doesn't
 * weaken the web's CSRF posture — browsers never attach Authorization
 * headers automatically to cross-site requests the way they do cookies.
 */
export function getRequestToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (match) return match[1];
  return request.cookies.get("session")?.value ?? null;
}
