import { NextResponse, type NextRequest } from "next/server";
import type { MyCustomerResponse } from "@sllights/shared/api-contract";
import { ApimError, getCustomer } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customer — the customer the signed-in user belongs to,
 * for the mobile Account tab.
 *
 * The customer id comes only from the caller's own session token, never
 * from the request, so this can't be used to look up any other customer.
 * Users without a customerId (Streetleaf staff) get `{ customer: null }`
 * without an APIM call. Returns only id and name — the Account tab needs
 * nothing else, so nothing else is exposed.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;

  const noStore = { headers: { "Cache-Control": "no-store" } };

  if (!session.customerId) {
    const body: MyCustomerResponse = { customer: null };
    return NextResponse.json(body, noStore);
  }

  try {
    const customer = await getCustomer(session.customerId, token);
    const body: MyCustomerResponse = {
      customer: customer ? { id: customer.id, name: customer.name } : null,
    };
    return NextResponse.json(body, noStore);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load your customer. Please try again." }, { status: 500 });
  }
}
