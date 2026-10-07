import { NextResponse, type NextRequest } from "next/server";
import type { PoleListResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { isSilentPole } from "@sllights/shared/format";
import { paginate } from "@sllights/shared/pagination";
import { ApimError, getCustomer, getProjectsForCustomer } from "@/lib/apim";
import { canViewCustomer } from "@/lib/mobile-views";
import { cachedPoles, toPoleListRow } from "@/lib/mobile-poles";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/poles — the web Poles page, searched and paged here
 * (10 per page) instead of sending every pole to the phone.
 *
 *   ?q=pas-1&page=2                  all poles the viewer may see
 *   ?faults=1&customerId=c1[&projectId=p1]
 *                                    the web's "Total faults" view: poles
 *                                    with isPoleFault that have reported
 *                                    within 48h, with each row's project
 *
 * Customer-scoped viewers only ever get their own customer's poles: the
 * fetch is scoped to them, rows are re-checked, and a faults request for
 * another customer — or a project that isn't theirs — is a 404.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;
  const viewerScoped = isCustomerScoped(session.role, session.customerId);

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const page = Number(params.get("page") ?? "1");
  const faults = params.get("faults") === "1";
  const customerId = params.get("customerId") ?? undefined;
  const projectId = params.get("projectId") ?? undefined;
  const noStore = { headers: { "Cache-Control": "no-store" } };
  const notFound = NextResponse.json({ error: "Not found." }, { status: 404 });

  if (viewerScoped && !session.customerId) {
    return NextResponse.json({ error: "Your account isn't linked to a customer." }, { status: 403 });
  }
  if (faults && !customerId) {
    return NextResponse.json({ error: "customerId is required for the faults view." }, { status: 400 });
  }
  if (faults && customerId && !canViewCustomer(session, customerId)) return notFound;

  try {
    let poles;
    let projectNames: Record<string, string> | undefined;
    let customerName: string | null | undefined;

    if (faults && customerId) {
      const [all, projects, customer] = await Promise.all([
        cachedPoles({ customerId }, token),
        getProjectsForCustomer(customerId, token),
        viewerScoped ? Promise.resolve(undefined) : getCustomer(customerId, token),
      ]);
      if (projectId && !projects.some((p) => p.id === projectId)) return notFound;
      projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));
      if (!viewerScoped) customerName = customer?.name ?? null;
      // As the web: faulted poles only, leaving out any that haven't
      // reported within 48h (their fault flag has no reliable basis).
      poles = all.filter(
        (pole) =>
          (!projectId || pole.projectId === projectId) &&
          pole.isPoleFault === true &&
          !isSilentPole(pole.lastUpdate),
      );
    } else {
      poles = await cachedPoles(viewerScoped ? { customerId: session.customerId as string } : {}, token);
    }

    // Belt and braces: never show a customer-scoped viewer anyone else's pole.
    if (viewerScoped) poles = poles.filter((pole) => pole.customerId === session.customerId);
    if (q) poles = poles.filter((pole) => pole.poleNumber.toLowerCase().includes(q));

    const current = paginate(poles, page);
    const body: PoleListResponse = {
      rows: current.items.map((pole) =>
        toPoleListRow(pole, viewerScoped, projectNames ? (projectNames[pole.projectId] ?? null) : undefined),
      ),
      page: current.page,
      totalPages: current.totalPages,
      totalItems: current.totalItems,
      firstItem: current.firstItem,
      lastItem: current.lastItem,
      ...(customerName !== undefined ? { customerName } : {}),
    };
    return NextResponse.json(body, noStore);
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Couldn't load poles. Please try again." }, { status: 500 });
  }
}
