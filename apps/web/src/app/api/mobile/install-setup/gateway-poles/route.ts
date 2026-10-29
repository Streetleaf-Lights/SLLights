import { NextResponse, type NextRequest } from "next/server";
import type { GatewayPolesResponse } from "@sllights/shared/api-contract";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { ApimError } from "@/lib/apim";
import { findInstallProject, gatewayPolesFor } from "@/lib/install-setup";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/install-setup/gateway-poles?projectId= — the project's
 * gateway poles for the Install screen's Step 2 (warehouse), and whether
 * each has its gateway registered. Field roles only; Install projects only.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  if (!canUseFieldTools(auth.session.role)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim();
  if (!projectId) return NextResponse.json({ error: "A projectId is required." }, { status: 400 });

  try {
    const project = await findInstallProject(projectId, auth.token);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const body: GatewayPolesResponse = { poles: await gatewayPolesFor(project, auth.token) };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't load the gateway poles. Please try again." }, { status: 500 });
  }
}
