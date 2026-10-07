import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { TransferOwnershipResponse } from "@sllights/shared/api-contract";
import { validateNewOwner } from "@sllights/shared/users";
import { ApimError, inviteUser } from "@/lib/apim";
import { authorizeUserAction } from "@/lib/mobile-users";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/mobile/users/{ownerId}/transfer-ownership { name, email } — the
 * web's Transfer Ownership: invites a new Customer Owner for this Owner's
 * customer (APIM removes the current Owner once they accept).
 *
 * Allowed only where the shared rules allow it (the Owner on their own
 * row, or a Streetleaf Admin). The customer comes from the current Owner's
 * own record and the role is always Customer Owner — any customerId or
 * role in the request body is ignored, so this can't invite into another
 * customer or grant a different role.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { userId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const newOwner = validateNewOwner(body);
  if (!newOwner.ok) return NextResponse.json({ error: newOwner.error }, { status: 400 });

  try {
    const allowed = await authorizeUserAction(auth.session, auth.token, userId, "transferOwnership");
    if (!allowed.ok) return allowed.response;
    const owner = allowed.user;

    await inviteUser(
      { ...newOwner.value, role: "Customer Owner", customerId: owner.customerId as string },
      auth.token,
    );
    revalidateTag("users", { expire: 0 });
    const ok: TransferOwnershipResponse = { success: true, customerName: owner.customerName };
    return NextResponse.json(ok);
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Invite failed. Please try again." }, { status: 500 });
  }
}
