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
  /** Invite a new Customer Owner for this Owner's customer (replacing them once accepted). */
  transferOwnership: boolean;
}

/**
 * The actions a viewer has on a user's row, exactly as the web table offers
 * them: nothing unless the viewer manages users (and can see this user);
 * Re-invite for a Pending user; on a Customer Owner, Transfer Ownership
 * (for the Owner themself or a Streetleaf Admin) and Delete (Streetleaf
 * Admin only, never on themselves) — never Change Role; never Change Role
 * or Delete on your own row; otherwise Change Role and Delete.
 */
export function userActions(viewer: SessionUser, user: Pick<User, "id" | "role" | "status" | "customerId">): UserActions {
  const none = { reinvite: false, changeRole: false, delete: false, transferOwnership: false };
  if (!canManageUsers(viewer.role) || !canSeeUser(viewer, user)) return none;

  const isSelf = user.id === viewer.id;
  const reinvite = userStatus(user.status) === "pending";

  if (user.role === "Customer Owner") {
    return {
      reinvite,
      changeRole: false,
      delete: !isSelf && viewer.role === "Streetleaf Admin",
      // The Owner handing over their own customer, or a Streetleaf Admin for any customer.
      transferOwnership: Boolean(user.customerId) && (isSelf || viewer.role === "Streetleaf Admin"),
    };
  }
  if (isSelf) return { ...none, reinvite };
  return { reinvite, changeRole: true, delete: true, transferOwnership: false };
}

/** The web invite form's email check. */
export const INVITE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the new owner's name and email for Transfer Ownership (as the web invite form). */
export function validateNewOwner(
  body: unknown,
): { ok: true; value: { name: string; email: string } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Malformed request body." };
  const { name, email } = body as Record<string, unknown>;
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  if (!trimmedName) return { ok: false, error: "Name is required." };
  if (!INVITE_EMAIL_PATTERN.test(trimmedEmail)) return { ok: false, error: "Enter a valid email address." };
  return { ok: true, value: { name: trimmedName, email: trimmedEmail } };
}
