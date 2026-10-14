import { NextResponse, type NextRequest } from "next/server";
import type { CustomerListResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { ApimError, getCustomers } from "@/lib/apim";
import { crewScope } from "@/lib/crew-scope";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customers — active customers for Streetleaf staff to pick
 * from (the web's /customers page). Customer-scoped users get 403, matching
 * proxy.ts blocking /customers for them on the web.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;

  if (isCustomerScoped(session.role, session.customerId)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }

  try {
    const [customers, crew] = await Promise.all([getCustomers({ active: true }, token), crewScope(session, token)]);
    // Streetleaf Crew: only customers with a project that has sticker numbers.
    const visible = crew ? customers.filter((c) => crew.customerIds.has(c.id)) : customers;
    const body: CustomerListResponse = {
      customers: visible
        .map((customer) => ({ id: customer.id, name: customer.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load customers. Please try again." }, { status: 500 });
  }
}
