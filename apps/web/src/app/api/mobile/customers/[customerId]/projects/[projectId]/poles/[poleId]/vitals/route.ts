import { NextResponse, type NextRequest } from "next/server";
import type { PoleVitalsResponse } from "@sllights/shared/api-contract";
import { isVitalsDays, vitalsLimitForDays } from "@sllights/shared/vitals-chart";
import { ApimError, getPoleVitalsByPeriod, getPoleVitalsForCustomer } from "@/lib/apim";
import { canViewCustomer } from "@/lib/mobile-views";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/customers/{customerId}/projects/{projectId}/poles/{poleId}/vitals?days=N
 * — hourly vitals for the mobile pole page's chart (N = 1, 2, 7, 14 or 30,
 * as on the web).
 *
 * Deliberately not the web's /api/getpolevitalsbyperiod: that route takes
 * any poleId and doesn't establish a session. Here the caller must be
 * signed in, may only reach their own customer's poles (404 otherwise),
 * and the pole must belong to the given project — checked against the same
 * customer vitals the pole page itself loads — before APIM is asked for
 * its history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; projectId: string; poleId: string }> },
) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  const { customerId, projectId, poleId } = await params;

  const days = Number(request.nextUrl.searchParams.get("days"));
  if (!isVitalsDays(days)) {
    return NextResponse.json({ error: "days must be one of 1, 2, 7, 14 or 30." }, { status: 400 });
  }

  const notFound = NextResponse.json({ error: "Pole not found." }, { status: 404 });
  if (!canViewCustomer(session, customerId)) return notFound;

  try {
    const vitals = await getPoleVitalsForCustomer(customerId, token);
    const belongs = vitals?.projects.find((p) => p.id === projectId)?.poles.some((p) => p.id === poleId);
    if (!belongs) return notFound;

    const history = await getPoleVitalsByPeriod({
      poleId,
      periodType: "Hour",
      limit: vitalsLimitForDays(days),
      token,
    });
    const body: PoleVitalsResponse = { vitals: history.vitals };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load vitals history. Please try again." }, { status: 500 });
  }
}
