import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import type { RegisterGatewayResponse } from "@sllights/shared/api-contract";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { GATEWAY_SERIAL_MAX_LENGTH, gatewayGroupName, installSetupFrom } from "@sllights/shared/install-options";
import { ApimError, populateLeadsunGateway } from "@/lib/apim";
import { findInstallProject, gatewayPolesFor } from "@/lib/install-setup";
import { requireSession } from "@/lib/require-session";

/**
 * POST /api/mobile/install-setup/gateway { projectId, poleNumber, gatewaySerial }
 * — the warehouse's "Register gateway" (Install screen, Step 2), via APIM's
 * populateLeadsunGateway. Everything sent to APIM comes from our records
 * except the scanned serial: the Leadsun project id, and the group name
 * "<gateway pole> <project name>".
 *  - Field roles only (403); Install projects only (404).
 *  - The project must be set up first (409).
 *  - The pole must be one of the project's gateway poles (422) without a
 *    gateway yet (409) — no duplicate groups on Leadsun.
 * Afterwards the cached project lists are cleared.
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { session, token } = auth;
  if (!canUseFieldTools(session.role)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }

  let body: { projectId?: unknown; poleNumber?: unknown; gatewaySerial?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const projectId = text(body.projectId);
  const poleNumber = text(body.poleNumber);
  const gatewaySerial = text(body.gatewaySerial);
  if (!projectId || !poleNumber) return NextResponse.json({ error: "A project and gateway pole are required." }, { status: 400 });
  if (!gatewaySerial) return NextResponse.json({ error: "Gateway Serial Number is required." }, { status: 400 });
  if (gatewaySerial.length > GATEWAY_SERIAL_MAX_LENGTH) {
    return NextResponse.json({ error: "That gateway serial number is too long." }, { status: 400 });
  }

  try {
    const project = await findInstallProject(projectId, token);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const leadsunProjectId = project.leadsunProject?.ProjectId;
    if (!leadsunProjectId) return NextResponse.json({ error: "Set up this project first." }, { status: 409 });

    const pole = (await gatewayPolesFor(project, token)).find((p) => p.poleNumber.toUpperCase() === poleNumber.toUpperCase());
    if (!pole) {
      return NextResponse.json({ error: `${poleNumber} isn't a gateway pole in this project.` }, { status: 422 });
    }
    if (pole.registered) {
      return NextResponse.json({ error: `A gateway is already registered for ${pole.poleNumber}.` }, { status: 409 });
    }

    const updated = await populateLeadsunGateway(
      { leadsunProjectId: String(leadsunProjectId), gatewaySerialNumber: gatewaySerial, groupName: gatewayGroupName(pole.poleNumber, project.name) },
      token,
    );
    revalidateTag("projects", { expire: 0 });
    const response: RegisterGatewayResponse = { projectId: project.id, gateways: installSetupFrom(updated).gateways };
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't register the gateway. Please try again." }, { status: 500 });
  }
}
