import { NextResponse, type NextRequest } from "next/server";
import { ApimError, getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer, toCustomerOverview } from "@/lib/mobile-views";
import { hasStickerNumbers, isCrew } from "@sllights/shared/crew-access";
import { crewMaySee } from "@/lib/crew-scope";
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
    if (!(await crewMaySee(session, token, customerId))) return notFound;
    const [customer, allProjects, vitals] = await Promise.all([
      getCustomer(customerId, token),
      getProjectsForCustomer(customerId, token),
      getPoleVitalsForCustomer(customerId, token),
    ]);
    if (!customer) return notFound;
    // Streetleaf Crew: just the projects with sticker numbers, and totals over those.
    const crew = isCrew(session.role);
    const projects = crew ? allProjects.filter(hasStickerNumbers) : allProjects;
    return NextResponse.json(toCustomerOverview(customer, projects, vitals, { summaryOverListedProjects: crew }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load this customer. Please try again." }, { status: 500 });
  }
}
