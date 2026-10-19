import type { NextRequest } from "next/server";
import { deleteOwnAccount } from "@/lib/delete-own-account";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/deleteaccount — the dashboard's "Delete my account": the
 * signed-in person (from the session cookie) deletes their own account and
 * is signed out. Takes no user id, so it only ever deletes the caller.
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  return deleteOwnAccount(auth.session, auth.token);
}
