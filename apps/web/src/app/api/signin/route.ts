import { NextResponse } from "next/server";
import { ApimError, signIn } from "@/lib/apim";
import { getSecondsUntilExpiry } from "@/lib/auth-role";

// Fallback only — used if the token can't be decoded for some reason.
// Deliberately conservative (shorter than we've observed the real tokens
// living) so a bad decode doesn't accidentally outlive the actual token.
const FALLBACK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * POST /api/signin — the client posts { email, password } here, never
 * directly to APIM. Two things make this the "safe" pattern rather than
 * calling APIM from the browser:
 *
 *  1. The APIM subscription key stays server-side only (it'd have to be
 *     exposed to the client otherwise).
 *  2. The JWT is set as an httpOnly cookie, never handed to client-side JS.
 *     httpOnly means it can't be read via `document.cookie` or exfiltrated
 *     by an XSS payload — the standard risk with storing tokens in
 *     localStorage/sessionStorage. The browser just replays it automatically
 *     on subsequent requests to this origin.
 *
 * The client only ever sees `{ user }` back — never the raw token.
 */
export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  let customerId: unknown;
  try {
    ({ email, password, customerId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    // customerId is optional and for debugging only — see signIn() in
    // apim.ts. Anything other than a non-empty string is treated as
    // absent, rather than rejecting the whole sign-in over a malformed
    // debug param.
    const { token, user } = await signIn(
      email,
      password,
      typeof customerId === "string" && customerId ? customerId : undefined,
    );

    const response = NextResponse.json({ user });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSecondsUntilExpiry(token) ?? FALLBACK_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
    }
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
