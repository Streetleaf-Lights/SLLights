import { NextResponse, type NextRequest } from "next/server";
import { ApimError, getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer, toProjectDetail } from "@/lib/mobile-views";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customers/{customerId}/projects/{projectId} — project
 * stats and pole list, from the same data as the web's project page.
 * Scoping as for the customer overview: 404 for another customer's project.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; projectId: string }> },
) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  const { customerId, projectId } = await params;

  const notFound = NextResponse.json({ error: "Project not found." }, { status: 404 });
  if (!canViewCustomer(session, customerId)) return notFound;

  try {
    const [customer, projects, vitals] = await Promise.all([
      getCustomer(customerId, token),
      getProjectsForCustomer(customerId, token),
      getPoleVitalsForCustomer(customerId, token),
    ]);
    const project = projects.find((p) => p.id === projectId);
    if (!customer || !project) return notFound;
    const projectVitals = vitals?.projects.find((p) => p.id === projectId);
    return NextResponse.json(toProjectDetail(customer, project, projectVitals), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load this project. Please try again." }, { status: 500 });
  }
}
