import { NextRequest, NextResponse } from "next/server";
import { ApimError, createPoleIssue } from "@/lib/apim";
import { getRequestToken } from "@/lib/request-auth";

/**
 * POST /api/createpoleissue — the client posts { poleNumber, status,
 * problemDetails } here rather than directly to APIM, so the
 * Ocp-Apim-Subscription-Key stays server-side only and the caller's JWT
 * (read from the httpOnly `session` cookie) can be attached as a Bearer
 * token without ever reaching client JS.
 */
export async function POST(request: NextRequest) {
  const token = getRequestToken(request);
  if (!token) {
    return NextResponse.json({ error: "Not authenticated. Please sign in again." }, { status: 401 });
  }

  let poleNumber: unknown;
  let status: unknown;
  let problemDetails: unknown;
  try {
    ({ poleNumber, status, problemDetails } = await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (typeof poleNumber !== "string" || !poleNumber.trim()) {
    return NextResponse.json({ error: "poleNumber is required." }, { status: 400 });
  }
  if (typeof status !== "string" || !status.trim()) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }
  if (typeof problemDetails !== "string" || !problemDetails.trim()) {
    return NextResponse.json({ error: "problemDetails is required." }, { status: 400 });
  }

  try {
    await createPoleIssue({ poleNumber, status, problemDetails }, token);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json(
      { error: "Failed to report the issue. Please try again." },
      { status: 500 },
    );
  }
}
