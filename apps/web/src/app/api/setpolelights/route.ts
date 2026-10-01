import { NextRequest, NextResponse } from "next/server";
import { ApimError, setPoleLights } from "@/lib/apim";

export const dynamic = "force-dynamic";

/**
 * POST /api/setpolelights — the Remote Control modal's GO!/TURN OFF
 * action. The client posts { brightness, time, and exactly one of
 * projectId/gatewayCode/poleNumber/poleNumbers } here rather than
 * directly to APIM, so the Ocp-Apim-Subscription-Key stays server-side
 * only and the caller's JWT (read from the httpOnly `session` cookie)
 * can be attached as a Bearer token without ever reaching client JS.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated. Please sign in again." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const { brightness, time, projectId, gatewayCode, poleNumber, poleNumbers } = body as Record<
    string,
    unknown
  >;

  if (typeof brightness !== "number" || typeof time !== "number") {
    return NextResponse.json(
      { error: "brightness and time are required numbers." },
      { status: 400 },
    );
  }

  const isValidPoleNumbers =
    Array.isArray(poleNumbers) &&
    poleNumbers.length > 0 &&
    poleNumbers.every((value) => typeof value === "string" && value.length > 0);

  const scopeFields = [
    projectId,
    gatewayCode,
    poleNumber,
    isValidPoleNumbers ? poleNumbers : undefined,
  ].filter((value) => (typeof value === "string" && value.length > 0) || Array.isArray(value));
  if (scopeFields.length !== 1) {
    return NextResponse.json(
      {
        error:
          "Exactly one of projectId, gatewayCode, poleNumber, or poleNumbers is required.",
      },
      { status: 400 },
    );
  }

  try {
    const params =
      typeof projectId === "string" && projectId
        ? { projectId, brightness, time }
        : typeof gatewayCode === "string" && gatewayCode
          ? { gatewayCode, brightness, time }
          : isValidPoleNumbers
            ? { poleNumbers: poleNumbers as string[], brightness, time }
            : { poleNumber: poleNumber as string, brightness, time };

    const result = await setPoleLights(params, token);
    return NextResponse.json(result);
  } catch (err) {
    // Without this, every failure looked identical to the client and left
    // no trace server-side — a 502 from APIM/a gateway in front of it,
    // for instance, was completely undebuggable. This is an internal
    // tool, so surfacing the real reason isn't a sensitive-data concern
    // the way it might be on a public-facing API.
    if (err instanceof ApimError) {
      console.error(
        "POST /api/setpolelights failed:",
        err.message,
        "status:",
        err.status ?? "unknown",
      );
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("POST /api/setpolelights failed (unexpected):", detail);
    return NextResponse.json(
      { error: "Set pole lights failed. Please try again.", detail },
      { status: 500 },
    );
  }
}
