import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import type { MobileRegisterResponse } from "@sllights/shared/api-contract";
import { checkNewPassword } from "@sllights/shared/password";
import { ApimError, registerUser } from "@/lib/apim";

/**
 * POST /api/mobile/registeruser { token, password } — the mobile "Set your
 * password" for an emailed invite: the web's /api/registeruser, but the new
 * session token comes back in the body (a phone has no cookie jar), as for
 * /api/mobile/signin. The invite token is the credential — no session yet.
 * Checks the web form's password rules here too, before reaching APIM.
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
  if (!checkNewPassword(password, password).valid) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters and include a special character." },
      { status: 400 },
    );
  }

  try {
    const { token: sessionToken, user } = await registerUser(token, password);
    // So an admin's Users list shows the newly registered person straight away.
    revalidateTag("users", { expire: 0 });
    const body: MobileRegisterResponse = { token: sessionToken, user };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
