import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@/lib/app-links";

export const dynamic = "force-dynamic";

/** Lets iOS open emailed invite/reset links in the app (see lib/app-links.ts). 404 until APPLE_TEAM_ID is set. */
export function GET() {
  const body = appleAppSiteAssociation(process.env.APPLE_TEAM_ID);
  if (!body) return new NextResponse(null, { status: 404 });
  // iOS requires application/json and no redirects for this file.
  return NextResponse.json(body, { headers: { "Content-Type": "application/json" } });
}
