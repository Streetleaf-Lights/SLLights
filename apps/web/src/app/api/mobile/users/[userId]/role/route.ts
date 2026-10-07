import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { ChangeRoleResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { userRoleLabel } from "@sllights/shared/users";
import { ApimError, changeRole } from "@/lib/apim";
import { authorizeUserAction } from "@/lib/mobile-users";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/mobile/users/{userId}/role — APIM's Change Role (it decides the
 * new role), only when the shared rules allow this viewer to change this
 * user's role. Returns the new role as this viewer would see it labelled.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  try {
    const allowed = await authorizeUserAction(auth.session, auth.token, userId, "changeRole");
    if (!allowed.ok) return allowed.response;
    const result = await changeRole(userId, auth.token);
    revalidateTag("users", { expire: 0 });
    const body: ChangeRoleResponse = {
      roleLabel: userRoleLabel(result.role, isCustomerScoped(auth.session.role, auth.session.customerId)),
    };
    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Change role failed. Please try again." }, { status: 500 });
  }
}
