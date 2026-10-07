import { NextResponse, type NextRequest } from "next/server";
import type { LightCommandResponse, ProjectRemoteResponse } from "@sllights/shared/api-contract";
import { isLampOn } from "@sllights/shared/leadsun";
import { validateProjectLightCommand } from "@sllights/shared/remote-control";
import type { LeadsunLampStatus, LeadsunProject, Project, SessionUser } from "@sllights/shared/types";
import { ApimError, getProjectsForCustomer, setPoleLights } from "@/lib/apim";
import { fetchLeadsunLampStatus } from "@/lib/leadsunClient";
import { canViewCustomer } from "@/lib/mobile-views";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
type Params = { params: Promise<{ customerId: string; projectId: string }> };

/** The caller may see this customer, and the project is theirs — else a 404 (as the other mobile routes). */
async function resolveProject(
  session: SessionUser,
  token: string,
  customerId: string,
  projectId: string,
): Promise<{ ok: true; project: Project } | { ok: false; response: NextResponse }> {
  const notFound = { ok: false as const, response: NextResponse.json({ error: "Project not found." }, { status: 404 }) };
  if (!canViewCustomer(session, customerId)) return notFound;
  const project = (await getProjectsForCustomer(customerId, token)).find((p) => p.id === projectId);
  return project ? { ok: true, project } : notFound;
}

function lampState(lamps: Map<string, LeadsunLampStatus> | null, providedProductId: string) {
  const lamp = lamps?.get(providedProductId);
  return lamp ? (isLampOn(lamp) ? "on" : "off") : "unknown";
}

/**
 * GET …/projects/{projectId}/remote — the web's project Remote Control
 * breakdown: gateways, their lights, and each light's live ON/OFF state.
 * `remote` is null for a project without Leadsun lights.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { customerId, projectId } = await params;

  try {
    const resolved = await resolveProject(auth.session, auth.token, customerId, projectId);
    if (!resolved.ok) return resolved.response;
    const leadsun = resolved.project.leadsunProject;
    if (!leadsun?.groups?.some((g) => (g.products?.length ?? 0) > 0)) {
      const body: ProjectRemoteResponse = { remote: null };
      return NextResponse.json(body, { headers: NO_STORE });
    }

    let lamps: Map<string, LeadsunLampStatus> | null = null;
    let statusError: string | null = null;
    try {
      lamps = new Map((await fetchLeadsunLampStatus(leadsun.ProjectId)).map((l) => [l.productId, l]));
    } catch (err) {
      console.error("GET mobile project remote status failed:", err instanceof Error ? err.message : String(err));
      statusError = "Couldn't load live ON/OFF status.";
    }

    const body: ProjectRemoteResponse = {
      remote: {
        projectName: leadsun.ProjectName,
        statusError,
        gateways: leadsun.groups.map((group) => ({
          name: group.GroupName,
          code: group.GatewayCode,
          lights: (group.products ?? []).map((product) => ({
            poleNumber: product.PoleNumber,
            productName: product.ProductName,
            providedProductId: product.ProvidedProductId,
            lamp: lampState(lamps, product.ProvidedProductId),
          })),
        })),
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

/** True only if every named gateway / light is part of this project's own Leadsun setup. */
function targetBelongs(leadsun: LeadsunProject, target: { kind: string; gatewayCode?: string; productNames?: string[] }) {
  if (target.kind === "project") return true;
  if (target.kind === "gateway") return leadsun.groups.some((g) => g.GatewayCode === target.gatewayCode);
  const own = new Set(leadsun.groups.flatMap((g) => (g.products ?? []).map((p) => p.ProductName)));
  return (target.productNames ?? []).every((name) => own.has(name));
}

/**
 * POST …/projects/{projectId}/remote { brightness, time, target } — the
 * web's Project / Gateway / light Control, for this project only. The
 * project scope uses this project's own id (never one from the request),
 * and a gateway or light list is refused unless every part of it belongs
 * to this project's Leadsun setup.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { customerId, projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const command = validateProjectLightCommand(body);
  if (!command.ok) return NextResponse.json({ error: command.error }, { status: 400 });

  try {
    const resolved = await resolveProject(auth.session, auth.token, customerId, projectId);
    if (!resolved.ok) return resolved.response;
    const leadsun = resolved.project.leadsunProject;
    if (!leadsun?.groups?.some((g) => (g.products?.length ?? 0) > 0)) {
      return NextResponse.json({ error: "This project has no remote control." }, { status: 404 });
    }
    const { target, brightness, time } = command.value;
    if (!targetBelongs(leadsun, target)) {
      return NextResponse.json({ error: "That gateway or light isn't part of this project." }, { status: 404 });
    }

    const scope =
      target.kind === "project"
        ? { projectId: resolved.project.id }
        : target.kind === "gateway"
          ? { gatewayCode: target.gatewayCode }
          : target.productNames.length === 1
            ? { poleNumber: target.productNames[0] }
            : { poleNumbers: target.productNames };

    const result = await setPoleLights({ ...scope, brightness, time }, auth.token);
    if (!result?.success) {
      return NextResponse.json({ error: result?.message || "Leadsun didn't accept the command." }, { status: 502 });
    }
    const ok: LightCommandResponse = { success: true, message: result.message || "Request successful" };
    return NextResponse.json(ok, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ApimError) {
      console.error("POST mobile project remote failed:", err.message, "status:", err.status ?? "unknown");
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    console.error("POST mobile project remote failed (unexpected):", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Couldn't send the command. Please try again." }, { status: 500 });
  }
}
