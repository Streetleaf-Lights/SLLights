import { NextResponse } from "next/server";
import type { MobileSignInResponse } from "@sllights/shared/api-contract";
import { ApimError, signIn } from "@/lib/apim";

/**
 * POST /api/mobile/signin — the mobile app's counterpart to /api/signin.
 *
 * Same APIM call, one deliberate difference: the JWT comes back in the
 * response body instead of an httpOnly cookie. A native app has no cookie
 * jar to hide it in; it stores the token in the OS keychain/keystore
 * (expo-secure-store) and sends it as `Authorization: Bearer` — which every
 * route using getRequestToken() accepts. The web sign-in form must keep
 * using /api/signin so browser JS never sees the token.
 *
 * The APIM subscription key still never leaves the server.
 */
export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const { token, user } = await signIn(email, password);
    const body: MobileSignInResponse = { token, user };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
    }
    return NextResponse.json({ error: "Sign in failed. Please try again." }, { status: 500 });
  }
}
