import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { ApimError, registerUser } from "@/lib/apim";
import { getSecondsUntilExpiry } from "@/lib/auth-role";

// Fallback only — used if the token can't be decoded for some reason.
// Deliberately conservative (shorter than we've observed the real tokens
// living) so a bad decode doesn't accidentally outlive the actual token.
const FALLBACK_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * POST /api/registeruser — the client posts { token, password } here rather
 * than directly to APIM, so the subscription key stays server-side and the
 * returned JWT can be set as an httpOnly cookie (never exposed to client
 * JS), same reasoning as /api/signin. `token` here is the invite token from
 * the emailed registration link, not a session token.
 */
export async function POST(request: Request) {
  let token: unknown;
  let password: unknown;
  try {
    ({ token, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof token !== "string" || !token.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
  }

  try {
    const { token: sessionToken, user } = await registerUser(token, password);
    // Without this, an admin viewing /users would still see the cached
    // pre-registration data (missing user, or stale status) from getUsers()'s
    // `next: { revalidate: 30 }` for up to 30s — same reasoning as
    // /api/inviteuser and /api/deleteuser.
    revalidateTag("users", { expire: 0 });

    const response = NextResponse.json({ user });
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSecondsUntilExpiry(sessionToken) ?? FALLBACK_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
    }
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 },
    );
  }
}
