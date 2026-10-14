import { NextResponse, type NextRequest } from "next/server";
import type { InstallResponse } from "@sllights/shared/api-contract";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { isCrewProject } from "@sllights/shared/crew-access";
import { validateInstallSubmission } from "@sllights/shared/install-submission";
import { AirtableError, createInstall, findInstallByPole } from "@/lib/airtableInstalls";
import { ApimError, getAllProjects, getUsers } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

const same = (a: string | null, b: string) => (a ?? "").trim().toUpperCase() === b.trim().toUpperCase();

/**
 * POST /api/mobile/installs — the Install form's Submit (sent from the
 * phone's offline queue, possibly long after capture). Records the install
 * in Airtable after checking:
 *  - the caller has the Install tab (Streetleaf Admin or Crew) — 403;
 *  - the install is complete and valid — 400;
 *  - its sticker belongs to that project, which is active — 422 (e.g. the
 *    office changed the stickers after the crew's list was saved offline);
 *  - the pole isn't already recorded: the same Install ID, or the same
 *    pole with the same serials, is this install again (a resend after a
 *    lost reply) — 200, nothing new written; a different install for the pole — 409, so two crews
 *    can't both record the same pole.
 * Records Installed By (the signed-in person's email), Captured At (when
 * the crew submitted it on the phone) and Install ID alongside the install.
 * Airtable trouble or rate limits come back as 5xx/429 so the phone keeps
 * the install and tries again later.
 */
export async function POST(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { session, token } = auth;
  if (!canUseFieldTools(session.role)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const checked = validateInstallSubmission(body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const install = checked.value;

  try {
    const project = (await getAllProjects(token)).find((p) => p.id === install.projectId);
    if (!project || !isCrewProject(project)) {
      return NextResponse.json({ error: "This project isn't open for installs any more." }, { status: 422 });
    }
    if (!project.stickerNumbers.some((s) => same(s, install.poleNumber))) {
      return NextResponse.json({ error: `${install.poleNumber} isn't one of this project's stickers.` }, { status: 422 });
    }

    const existing = await findInstallByPole(install.poleNumber);
    if (existing) {
      // This very install (same Install ID — a resend after a lost reply), or
      // an identical one for the pole: already recorded, nothing new written.
      const sameInstall = existing.installId === install.id;
      if (sameInstall || (same(existing.solarPanelSerial, install.solarPanelSerial) && same(existing.lightHeadSerial, install.lightHeadSerial))) {
        const ok: InstallResponse = { success: true, recordId: existing.id, alreadyRecorded: true };
        return NextResponse.json(ok);
      }
      return NextResponse.json(
        { error: `${install.poleNumber} already has an install recorded with different serial numbers.` },
        { status: 409 },
      );
    }

    // Installed By: the signed-in person's email, from the server's own user
    // list (the session only carries their id) — never taken from the request.
    const user = (await getUsers(token)).find((u) => u.id === session.id);
    const recordId = await createInstall(install, user?.email || `user ${session.id}`);
    const ok: InstallResponse = { success: true, recordId, alreadyRecorded: false };
    return NextResponse.json(ok);
  } catch (err) {
    if (err instanceof AirtableError) {
      console.error("POST mobile install (Airtable):", err.status, err.message);
      // 422 from Airtable means the record itself was refused (e.g. a field changed in the base).
      if (err.status === 422) return NextResponse.json({ error: `Airtable refused the install: ${err.message}` }, { status: 422 });
      if (err.status === 429) return NextResponse.json({ error: "Airtable is busy. The install will be sent again shortly." }, { status: 429 });
      return NextResponse.json({ error: "Couldn't record the install right now. It will be sent again." }, { status: 503 });
    }
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 503 });
    console.error("POST mobile install (unexpected):", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Couldn't record the install right now. It will be sent again." }, { status: 503 });
  }
}
