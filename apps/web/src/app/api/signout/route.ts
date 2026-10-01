import { NextRequest, NextResponse } from "next/server";
import { ApimError, signOut } from "@/lib/apim";
import { getRequestToken } from "@/lib/request-auth";

/**
 * POST /api/signout — calls APIM's /signOut with the caller's own JWT (read
 * from the httpOnly `session` cookie, never exposed to client JS) and then
 * clears that cookie. If there's no session cookie to begin with, the
 * person is already signed out as far as this app is concerned, so this
 * short-circuits to success rather than erroring.
 */
export async function POST(request: NextRequest) {
  const token = getRequestToken(request);

  if (!token) {
    return NextResponse.json({ success: true });
  }

  try {
    await signOut(token);
  } catch (err) {
    if (err instanceof ApimError && (err.status === 401 || err.status === 403)) {
      // The token was already invalid/expired — from the user's
      // perspective "sign out" just means "stop being signed in here",
      // which is already true. Clear the cookie instead of leaving them
      // stuck on an error with no way to actually sign out via the UI.
      const response = NextResponse.json({ success: true });
      response.cookies.delete("session");
      return response;
    }
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Sign out failed. Please try again." }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
