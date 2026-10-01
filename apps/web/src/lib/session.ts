import { cookies } from "next/headers";
import { decodeSessionToken, type SessionUser } from "@/lib/auth-role";

export type { SessionUser } from "@/lib/auth-role";
export { decodeSessionToken, homeRouteForRole, isCustomerScoped } from "@/lib/auth-role";

/** Reads the session cookie (Server Components / Route Handlers only) and decodes it. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return decodeSessionToken(token);
}

/**
 * The raw session JWT (Server Components / Route Handlers only) — for
 * passing to an apim.ts function that sends it on as a Bearer token.
 * getSessionUser() intentionally returns only the *decoded* claims, not
 * this; most callers just need to know who's logged in, and shouldn't be
 * handed the raw token unless they're actually about to forward it.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value ?? null;
}
