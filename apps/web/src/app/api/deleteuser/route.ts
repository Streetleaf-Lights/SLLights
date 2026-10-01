import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ApimError, deleteUser } from "@/lib/apim";

/**
 * POST /api/deleteuser — the client posts { userId } here rather than
 * directly to APIM, so the Ocp-Apim-Subscription-Key stays server-side only
 * and the caller's JWT (read from the httpOnly `session` cookie) can be
 * attached as a Bearer token without ever reaching client JS.
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
    await deleteUser(userId, token);
    // Without this, the client's router.refresh() would still hit the
    // Next.js Data Cache entry from getUsers()'s `next: { revalidate: 30 }`
    // and keep showing the deleted user for up to 30s — same reasoning as
    // /api/inviteuser.
    revalidateTag("users", { expire: 0 });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Delete failed. Please try again." }, { status: 500 });
  }
}
