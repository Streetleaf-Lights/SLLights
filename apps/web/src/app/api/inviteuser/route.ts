import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ApimError, inviteUser } from "@/lib/apim";

/**
 * POST /api/inviteuser — the client posts { name, email, role, customerId? }
 * here rather than directly to APIM, so the Ocp-Apim-Subscription-Key stays
 * server-side only (same reasoning as /api/signin). It also needs the
 * caller's own JWT as a Bearer token, which we read off the httpOnly
 * `session` cookie set at sign-in — the client never handles that token
 * directly.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated. Please sign in again." }, { status: 401 });
  }

  let name: unknown;
  let email: unknown;
  let role: unknown;
  let customerId: unknown;
  try {
    ({ name, email, role, customerId } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof role !== "string" ||
    !role.trim()
  ) {
    return NextResponse.json({ error: "Name, email, and role are required." }, { status: 400 });
  }

  if (customerId !== undefined && typeof customerId !== "string") {
    return NextResponse.json({ error: "customerId must be a string." }, { status: 400 });
  }

  try {
    const result = await inviteUser(
      {
        name,
        email,
        role,
        customerId: customerId || undefined,
      },
      token,
    );
    // Without this, the client's router.refresh() would still hit the
    // Next.js Data Cache entry from getUsers()'s `next: { revalidate: 30 }`
    // and keep showing the pre-invite list for up to 30s. { expire: 0 }
    // forces immediate invalidation rather than a stale-while-revalidate
    // window.
    revalidateTag("users", { expire: 0 });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Invite failed. Please try again." }, { status: 500 });
  }
}
