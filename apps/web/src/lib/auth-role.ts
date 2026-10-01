// decodeSessionToken / isCustomerScoped / getSecondsUntilExpiry now live in
// @sllights/shared (runtime-agnostic, no Buffer) so the mobile app applies
// the same role rules. Re-exported here so existing imports keep working.
import { isCustomerScoped } from "@sllights/shared/auth-role";
export type { SessionUser } from "@sllights/shared/types";

export {
  decodeSessionToken,
  getSecondsUntilExpiry,
  isCustomerScoped,
} from "@sllights/shared/auth-role";

/**
 * Where a person should land right after signing in/registering, or when
 * redirected off a page they can't access. Web routes only, so it stays in
 * the web app rather than @sllights/shared.
 */
export function homeRouteForRole(
  role: string | null | undefined,
  customerId?: string | null,
): string {
  return isCustomerScoped(role, customerId) ? "/projects" : "/customers";
}
