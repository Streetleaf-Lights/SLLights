import { NextResponse } from "next/server";
import { ApimError, forgotPassword } from "@/lib/apim";

/**
 * POST /api/forgotpassword — the client posts { email } here rather than
 * directly to APIM, so the subscription key stays server-side (same
 * reasoning as /api/signin).
 */
export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const result = await forgotPassword(email.trim());
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
