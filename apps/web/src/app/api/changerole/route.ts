import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ApimError, changeRole } from "@/lib/apim";

/**
 * POST /api/changerole — the client posts { userId } here rather than
 * directly to APIM, so the Ocp-Apim-Subscription-Key stays server-side only
 * and the caller's JWT (read from the httpOnly `session` cookie) can be
 * attached as a Bearer token without ever reaching client JS. That token
 * also happens to be what APIM itself uses to authorize the action (it
 * requires the caller to be a Streetleaf Admin or Customer Admin), so an
 * unauthorized caller gets APIM's own 400 forwarded back to them as-is.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated. Please sign in again." }, { status: 401 });
  }

  let userId: unknown;
  try {
    ({ userId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  try {
    const result = await changeRole(userId, token);
    // Without this, the client's router.refresh() would still hit the
    // Next.js Data Cache entry from getUsers()'s `next: { revalidate: 30 }`
    // and keep showing the pre-change role for up to 30s — same reasoning
    // as /api/deleteuser and /api/inviteuser. This is the fix for the bug
    // where the inline "Role changed to X." message showed correctly but
    // the Role column itself stayed stale until a hard page reload.
    revalidateTag("users", { expire: 0 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json(
      { error: "Change role failed. Please try again." },
      { status: 500 },
    );
  }
}
