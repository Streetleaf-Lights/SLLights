import { NextResponse } from "next/server";
import { ApimError, resetPassword } from "@/lib/apim";

/**
 * POST /api/resetpassword — the client posts { token, newPassword } here
 * rather than directly to APIM, so the subscription key stays server-side
 * (same reasoning as /api/signin). No session is established here — unlike
 * /api/registeruser, a reset doesn't sign the person in.
 */
export async function POST(request: Request) {
  let token: unknown;
  let newPassword: unknown;
  try {
    ({ token, newPassword } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
  }

  try {
    const result = await resetPassword(token, newPassword);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 400 });
    }
    return NextResponse.json({ error: "Reset failed. Please try again." }, { status: 500 });
  }
}
