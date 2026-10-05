import { NextResponse, type NextRequest } from "next/server";
import { ApimError, getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer, toCustomerOverview } from "@/lib/mobile-views";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customers/{customerId} — customer overview (header,
 * summary stats, projects), the same three APIM calls as the web's
 * /customers/{id} and /projects pages.
 *
 * Another customer's id returns 404 for a customer-scoped caller, the same
 * answer as a customer that doesn't exist, so the response doesn't confirm
 * which ids are real.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  const { customerId } = await params;

  const notFound = NextResponse.json({ error: "Customer not found." }, { status: 404 });
  if (!canViewCustomer(session, customerId)) return notFound;

  try {
    const [customer, projects, vitals] = await Promise.all([
      getCustomer(customerId, token),
      getProjectsForCustomer(customerId, token),
      getPoleVitalsForCustomer(customerId, token),
    ]);
    if (!customer) return notFound;
    return NextResponse.json(toCustomerOverview(customer, projects, vitals), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load this customer. Please try again." }, { status: 500 });
  }
}
