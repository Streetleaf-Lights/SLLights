import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { InviteUserResponse } from "@sllights/shared/api-contract";
import { canManageUsers, inviteRoleOptions, isStreetleafCustomerName, validateNewOwner } from "@sllights/shared/users";
import { ApimError, getCustomers, inviteUser } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/mobile/users/invite { name, email, role, customerId? } — the
 * web's Invite User, with its form rules enforced here (the web route
 * leaves them to the form):
 *  - only Streetleaf Admins, Customer Admins and Customer Owners invite;
 *  - a Customer Admin/Owner always invites into their own customer — any
 *    customerId in the request is ignored;
 *  - a Streetleaf Admin's customerId must be an active customer; the
 *    "Streetleaf" customer record means a Streetleaf (no-customer) invite;
 *  - the role must be one inviteRoleOptions offers that viewer for that
 *    customer context (e.g. never Streetleaf Admin from a customer's admin).
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { session, token } = auth;
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "You can't invite users." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const invitee = validateNewOwner(body);
  if (!invitee.ok) return NextResponse.json({ error: invitee.error }, { status: 400 });
  const { role, customerId: requestedCustomerId } = body as { role?: unknown; customerId?: unknown };
  if (typeof role !== "string" || !role.trim()) {
    return NextResponse.json({ error: "A role is required." }, { status: 400 });
  }

  try {
    let customerId: string | undefined;
    let customerName: string | null = null;

    if (session.role === "Streetleaf Admin") {
      if (requestedCustomerId !== undefined && requestedCustomerId !== null && requestedCustomerId !== "") {
        if (typeof requestedCustomerId !== "string") {
          return NextResponse.json({ error: "customerId must be a string." }, { status: 400 });
        }
        const customer = (await getCustomers({ active: true }, token)).find((c) => c.id === requestedCustomerId);
        if (!customer) return NextResponse.json({ error: "That customer isn't available." }, { status: 400 });
        if (!isStreetleafCustomerName(customer.name)) {
          customerId = customer.id;
          customerName = customer.name;
        }
      }
    } else {
      // Customer Admin / Owner: their own customer, whatever was sent.
      if (!session.customerId) {
        return NextResponse.json({ error: "Your account isn't linked to a customer." }, { status: 403 });
      }
      customerId = session.customerId;
    }

    if (!inviteRoleOptions(session.role, customerId !== undefined).includes(role)) {
      return NextResponse.json({ error: "You can't invite someone with that role." }, { status: 403 });
    }

    await inviteUser({ ...invitee.value, role, ...(customerId ? { customerId } : {}) }, token);
    revalidateTag("users", { expire: 0 });
    const ok: InviteUserResponse = { success: true, role, customerName };
    return NextResponse.json(ok);
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Invite failed. Please try again." }, { status: 500 });
  }
}
