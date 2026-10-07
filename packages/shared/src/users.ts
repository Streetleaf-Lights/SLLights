import { isCustomerScoped } from "./auth-role";
import type { SessionUser, User } from "./types";

/**
 * The web Users page's rules, shared by the mobile Users screen (to decide
 * which buttons to show) and its server routes (which enforce the same
 * rules before any change reaches APIM).
 */

export type UserStatus = "active" | "pending" | "inactive";

/** The web's status badge: Active, Pending (invited, not yet accepted), or Inactive. */
export function userStatus(status: string | null | undefined): UserStatus {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  return "inactive";
}

/** Customer-scoped viewers see "Admin"/"Owner" (the customer is implied), others the full role. */
export function userRoleLabel(role: string, viewerScoped: boolean): string {
  if (!viewerScoped) return role;
  if (role === "Customer Admin") return "Admin";
  if (role === "Customer Owner") return "Owner";
  return role;
}

/** Who may manage users at all: Streetleaf Admin, Customer Admin, Customer Owner (never plain Users). */
export function canManageUsers(role: string | null | undefined): boolean {
  return role === "Streetleaf Admin" || role === "Customer Admin" || role === "Customer Owner";
}

/** Who a viewer sees: everyone for Streetleaf staff, their own customer's people otherwise. */
export function canSeeUser(viewer: SessionUser, user: Pick<User, "customerId">): boolean {
  return !isCustomerScoped(viewer.role, viewer.customerId) || user.customerId === viewer.customerId;
}

export interface UserActions {
  reinvite: boolean;
  changeRole: boolean;
  delete: boolean;
}

/**
 * The actions a viewer has on a user's row, exactly as the web table offers
 * them: nothing unless the viewer manages users (and can see this user);
 * Re-invite for a Pending user; on a Customer Owner, only Delete — and only
 * for a Streetleaf Admin, never on themselves; never Change Role or Delete
 * on your own row; otherwise Change Role and Delete.
 */
export function userActions(viewer: SessionUser, user: Pick<User, "id" | "role" | "status" | "customerId">): UserActions {
  const none = { reinvite: false, changeRole: false, delete: false };
  if (!canManageUsers(viewer.role) || !canSeeUser(viewer, user)) return none;

  const isSelf = user.id === viewer.id;
  const reinvite = userStatus(user.status) === "pending";

  if (user.role === "Customer Owner") {
    return { reinvite, changeRole: false, delete: !isSelf && viewer.role === "Streetleaf Admin" };
  }
  if (isSelf) return { ...none, reinvite };
  return { reinvite, changeRole: true, delete: true };
}
