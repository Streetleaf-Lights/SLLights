import { NextResponse, type NextRequest } from "next/server";
import { validatePoleInstallRequest } from "@sllights/shared/api-contract";
import { isStreetleafStaff } from "@sllights/shared/auth-role";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/mobile/poleinstall — records a field install from the mobile
 * scanner (pole number + GPS + time + notes).
 *
 * NOT YET CONNECTED: there's no APIM operation for registering an install
 * yet. This route already does everything up to that call — auth, and the
 * same payload validation the app runs before submitting (shared
 * validatePoleInstallRequest) — then answers 501 so the app can show an
 * honest "not available yet" instead of pretending it saved.
 *
 * When the APIM operation exists: add an apim.ts function (Bearer token +
 * subscription key, like createPoleIssue), call it here with
 * `validation.value` and `auth.token`. Only Streetleaf staff may record
 * installs (customer-scoped users get 403).
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;

  // Installs are field work for Streetleaf staff; customers can't record them.
  if (!isStreetleafStaff(auth.session.role, auth.session.customerId)) {
    return NextResponse.json({ error: "Recording installs isn't available for your account." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const validation = validatePoleInstallRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  return NextResponse.json(
    { error: "Recording installs isn't available yet. Your scan wasn't saved." },
    { status: 501 },
  );
}
