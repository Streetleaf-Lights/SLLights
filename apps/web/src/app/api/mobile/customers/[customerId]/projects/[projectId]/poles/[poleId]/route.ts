import { NextResponse, type NextRequest } from "next/server";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { ApimError, getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer, toPoleDetail } from "@/lib/mobile-views";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customers/{customerId}/projects/{projectId}/poles/{poleId}
 * — one pole's page, from the same three APIM calls as the web pole page,
 * shaped for the viewer's role. 404 for another customer's pole (same
 * answer as one that doesn't exist).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; projectId: string; poleId: string }> },
) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  const { customerId, projectId, poleId } = await params;

  const notFound = NextResponse.json({ error: "Pole not found." }, { status: 404 });
  if (!canViewCustomer(session, customerId)) return notFound;

  try {
    const [customer, projects, vitals] = await Promise.all([
      getCustomer(customerId, token),
      getProjectsForCustomer(customerId, token),
      getPoleVitalsForCustomer(customerId, token),
    ]);
    const project = projects.find((p) => p.id === projectId);
    const pole = vitals?.projects.find((p) => p.id === projectId)?.poles.find((p) => p.id === poleId);
    if (!customer || !project || !pole) return notFound;

    const viewerScoped = isCustomerScoped(session.role, session.customerId);
    return NextResponse.json(toPoleDetail(customer, project, pole, viewerScoped), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load this pole. Please try again." }, { status: 500 });
  }
}
