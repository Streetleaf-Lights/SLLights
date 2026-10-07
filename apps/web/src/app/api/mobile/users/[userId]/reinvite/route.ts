import { NextResponse, type NextRequest } from "next/server";
import { ApimError, resendInvite } from "@/lib/apim";
import { authorizeUserAction } from "@/lib/mobile-users";
import { requireSession } from "@/lib/require-session";

/** POST /api/mobile/users/{userId}/reinvite — resends a Pending user's invite, if this viewer may. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  try {
    const allowed = await authorizeUserAction(auth.session, auth.token, userId, "reinvite");
    if (!allowed.ok) return allowed.response;
    await resendInvite(userId, auth.token);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Re-invite failed. Please try again." }, { status: 500 });
  }
}
