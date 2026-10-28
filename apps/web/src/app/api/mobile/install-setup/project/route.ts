import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { isCrewProject } from "@sllights/shared/crew-access";
import { ApimError, getAllProjects, populateLeadsunProject } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

/** Sent as the Leadsun project's remark: no names or emails (it goes to a third party). */
export const SETUP_REMARK = "Created from the Streetleaf Lights app";

/**
 * POST /api/mobile/install-setup/project { projectId } — the warehouse's
 * "Set up project" on the Install screen (Step 1): creates the project on
 * Leadsun via APIM's populateLeadsunProject.
 *  - Only the roles with the Install tab (Streetleaf Admin, Crew) — 403.
 *  - Only a project offered on the Install screen (active, with stickers),
 *    named from our own records, not the request — 404.
 *  - Only once: a project that already has a Leadsun project is refused
 *    (409), since each call would create another one on Leadsun.
 * Afterwards the cached project lists are cleared, so the Install screen's
 * refresh shows Step 2 straight away.
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { session, token } = auth;
  if (!canUseFieldTools(session.role)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }

  let projectId: unknown;
  try {
    ({ projectId } = (await request.json()) as { projectId?: unknown });
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId.trim()) {
    return NextResponse.json({ error: "A projectId is required." }, { status: 400 });
  }

  try {
    const project = (await getAllProjects(token)).find((p) => p.id === projectId);
    if (!project || !isCrewProject(project)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    if (project.leadsunProject?.ProjectId) {
      return NextResponse.json({ error: "This project is already set up." }, { status: 409 });
    }

    const { leadsunProjectId } = await populateLeadsunProject(
      { projectId: project.id, projectName: project.name, remark: SETUP_REMARK },
      token,
    );
    revalidateTag("projects", { expire: 0 });
    return NextResponse.json({ projectId: project.id, leadsunProjectId }, { status: 201 });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't set up the project. Please try again." }, { status: 500 });
  }
}
