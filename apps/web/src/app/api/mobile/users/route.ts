import { NextResponse, type NextRequest } from "next/server";
import type { UsersResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { canSeeUser } from "@sllights/shared/users";
import { ApimError, getUsers } from "@/lib/apim";
import { toUserRow } from "@/lib/mobile-users";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/users — the web Users page's list: everyone for Streetleaf
 * staff, a customer-scoped viewer's own customer otherwise (getUsers isn't
 * scoped by APIM, so it's filtered here), each row with the viewer's
 * allowed actions.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  if (isCustomerScoped(session.role, session.customerId) && !session.customerId) {
    return NextResponse.json({ error: "Your account isn't linked to a customer." }, { status: 403 });
  }
  try {
    const users = (await getUsers(token)).filter((u) => canSeeUser(session, u));
    const body: UsersResponse = { users: users.map((u) => toUserRow(u, session)) };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't load users. Please try again." }, { status: 500 });
  }
}
