import { NextResponse } from "next/server";
import type { UserRow } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import type { SessionUser, User } from "@sllights/shared/types";
import { canSeeUser, userActions, userRoleLabel, userStatus, type UserActions } from "@sllights/shared/users";
import { getUsers } from "@/lib/apim";

export function toUserRow(user: User, viewer: SessionUser): UserRow {
  const viewerScoped = isCustomerScoped(viewer.role, viewer.customerId);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleLabel: userRoleLabel(user.role, viewerScoped),
    status: userStatus(user.status),
    ...(viewerScoped ? {} : { customerName: user.customerName }),
    customerId: user.customerId,
    actions: userActions(viewer, user),
  };
}

/**
 * The target of a user-management action, if the shared rules allow this
 * viewer this action on them. 404 when the user doesn't exist or isn't
 * visible to the viewer (so other customers' user ids aren't confirmed);
 * 403 when visible but the action isn't theirs to take. The web's own
 * routes leave these checks to its buttons; here they're enforced.
 */
export async function authorizeUserAction(
  viewer: SessionUser,
  token: string,
  userId: string,
  action: keyof UserActions,
): Promise<{ ok: true; user: User } | { ok: false; response: NextResponse }> {
  const user = (await getUsers(token)).find((u) => u.id === userId);
  if (!user || !canSeeUser(viewer, user)) {
    return { ok: false, response: NextResponse.json({ error: "User not found." }, { status: 404 }) };
  }
  if (!userActions(viewer, user)[action]) {
    return { ok: false, response: NextResponse.json({ error: "You can't do that for this user." }, { status: 403 }) };
  }
  return { ok: true, user };
}
