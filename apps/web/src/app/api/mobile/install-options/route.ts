import { NextResponse, type NextRequest } from "next/server";
import type { InstallOptionsResponse } from "@sllights/shared/api-contract";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { isCrewProject } from "@sllights/shared/crew-access";
import { ApimError, getAllProjects, getCustomers } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/install-options — the Install form's project and sticker
 * dropdowns: active projects with sticker numbers, sorted by customer then
 * project, stickers in their issued order. Only for the roles that have the
 * Install tab (Streetleaf Admin and Crew); 403 otherwise.
 *
 * Stickers already installed aren't removed here yet — there's no install
 * endpoint to know them. The phone hides the ones it has submitted itself;
 * once installs are recorded server-side, leave installed stickers out here
 * too, so two crews can't install the same pole.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  if (!canUseFieldTools(session.role)) {
    return NextResponse.json({ error: "Not available for your account." }, { status: 403 });
  }

  try {
    const [projects, customers] = await Promise.all([getAllProjects(token), getCustomers({ active: true }, token)]);
    const customerNames = new Map(customers.map((c) => [c.id, c.name.trim()]));
    const body: InstallOptionsResponse = {
      generatedAt: new Date().toISOString(),
      projects: projects
        .filter(isCrewProject)
        .map((p) => ({
          id: p.id,
          name: p.name,
          customerName: (p.customerId && customerNames.get(p.customerId)) || null,
          stickerNumbers: p.stickerNumbers,
        }))
        .sort(
          (a, b) =>
            (a.customerName ?? "").localeCompare(b.customerName ?? "") || a.name.localeCompare(b.name),
        ),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    return NextResponse.json({ error: "Couldn't load projects. Please try again." }, { status: 500 });
  }
}
