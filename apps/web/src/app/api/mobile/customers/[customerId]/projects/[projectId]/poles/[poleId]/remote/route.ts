import { NextResponse, type NextRequest } from "next/server";
import type { LightCommandResponse, PoleRemoteResponse } from "@sllights/shared/api-contract";
import { isLampOn } from "@sllights/shared/leadsun";
import { validateLightCommand } from "@sllights/shared/remote-control";
import { ApimError, setPoleLights } from "@/lib/apim";
import { fetchLeadsunLampStatus } from "@/lib/leadsunClient";
import { resolvePoleRemote } from "@/lib/mobile-remote";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
type Params = { params: Promise<{ customerId: string; projectId: string; poleId: string }> };

/**
 * GET …/poles/{poleId}/remote — this pole's Leadsun identity and its live
 * ON/OFF state (null `remote` when the pole has no Leadsun product).
 *
 * Unlike the web's /api/leadsunlampstatus (any projectId, session cookie
 * only checked for presence), this verifies the session, the caller's
 * customer and the pole's project before asking Leadsun about one lamp.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { customerId, projectId, poleId } = await params;

  try {
    const resolved = await resolvePoleRemote(auth.session, auth.token, customerId, projectId, poleId);
    if (!resolved.ok) return resolved.response;
    const { leadsunProject, product, group } = resolved;
    if (!leadsunProject || !product) {
      const body: PoleRemoteResponse = { remote: null };
      return NextResponse.json(body, { headers: NO_STORE });
    }

    let lamp: "on" | "off" | "unknown" = "unknown";
    let statusError: string | null = null;
    try {
      const lamps = await fetchLeadsunLampStatus(leadsunProject.ProjectId, product.ProvidedProductId);
      // Leadsun keys live status by ProvidedProductId (as the web does).
      const match = lamps.find((l) => l.productId === product.ProvidedProductId);
      if (match) lamp = isLampOn(match) ? "on" : "off";
    } catch (err) {
      // The cause (certificate, network, Leadsun error) goes to the server
      // log, not to the phone — customers use this app too.
      console.error("GET mobile remote status failed:", err instanceof Error ? err.message : String(err));
      statusError = "Couldn't load live ON/OFF status.";
    }

    const body: PoleRemoteResponse = {
      remote: {
        productName: product.ProductName,
        providedProductId: product.ProvidedProductId,
        gatewayName: group?.GroupName ?? null,
        lamp,
        statusError,
      },
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500, headers: NO_STORE });
    }
    return NextResponse.json({ error: "Couldn't load remote control. Please try again." }, { status: 500, headers: NO_STORE });
  }
}

/**
 * POST …/poles/{poleId}/remote { brightness, time } — switches THIS pole's
 * light. The target is the Leadsun product matched to this pole (as the
 * web's single-pole "Light Remote Control" sends it); any projectId /
 * gatewayCode / poleNumber(s) in the body are ignored, so a phone can't
 * reach a light other than the one on its screen.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { customerId, projectId, poleId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const command = validateLightCommand(body);
  if (!command.ok) return NextResponse.json({ error: command.error }, { status: 400 });

  try {
    const resolved = await resolvePoleRemote(auth.session, auth.token, customerId, projectId, poleId);
    if (!resolved.ok) return resolved.response;
    if (!resolved.product) {
      return NextResponse.json({ error: "This pole has no remote control." }, { status: 404 });
    }

    const result = await setPoleLights(
      { poleNumber: resolved.product.ProductName, ...command.value },
      auth.token,
    );
    if (!result?.success) {
      return NextResponse.json({ error: result?.message || "Leadsun didn't accept the command." }, { status: 502 });
    }
    const ok: LightCommandResponse = { success: true, message: result.message || "Request successful" };
    return NextResponse.json(ok, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ApimError) {
      console.error("POST mobile remote failed:", err.message, "status:", err.status ?? "unknown");
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    console.error("POST mobile remote failed (unexpected):", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Couldn't send the command. Please try again." }, { status: 500 });
  }
}
