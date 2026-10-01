import { NextRequest, NextResponse } from "next/server";
import { ApimError, getPoleVitalsByPeriod } from "@/lib/apim";

const VALID_PERIOD_TYPES = ["Hour", "Day"] as const;

/**
 * GET /api/getpolevitalsbyperiod?poleId=&periodType=&limit= — the client
 * calls this (not APIM directly) so the subscription key stays server-side,
 * same reasoning as the other /api routes. This one's a read, not a
 * mutation, but still needs a proxy since the key can't be exposed to the
 * browser.
 */
export async function GET(request: NextRequest) {
  const poleId = request.nextUrl.searchParams.get("poleId");
  const periodType = request.nextUrl.searchParams.get("periodType");
  const limitParam = request.nextUrl.searchParams.get("limit");

  if (!poleId) {
    return NextResponse.json({ error: "poleId is required." }, { status: 400 });
  }

  if (!VALID_PERIOD_TYPES.includes(periodType as (typeof VALID_PERIOD_TYPES)[number])) {
    return NextResponse.json(
      { error: "periodType must be one of: Hour, Day" },
      { status: 400 },
    );
  }

  const limit = Number(limitParam);
  if (!limitParam || !Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "limit must be a positive number." }, { status: 400 });
  }

  try {
    const result = await getPoleVitalsByPeriod({
      poleId,
      periodType: periodType as "Hour" | "Day",
      limit,
      token: request.cookies.get("session")?.value,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json(
      { error: "Failed to load pole vitals. Please try again." },
      { status: 500 },
    );
  }
}
