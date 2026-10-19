import type { NextRequest } from "next/server";
import { deleteOwnAccount } from "@/lib/delete-own-account";
import { requireSession } from "@/lib/require-session";

/** DELETE /api/mobile/account — the signed-in person deletes their own account (any role). */
export async function DELETE(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  return deleteOwnAccount(auth.session, auth.token);
}
