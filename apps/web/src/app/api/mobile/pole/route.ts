import { NextResponse, type NextRequest } from "next/server";
import type { PoleLookupResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { POLE_NUMBER_PATTERN } from "@sllights/shared/scan";
import { ApimError, getPoles } from "@/lib/apim";
import { requireSession } from "@/lib/require-session";

/**
 * GET /api/mobile/pole?poleNumber=PAS-4938 — looks up a scanned pole.
 *
 * Scoping is enforced HERE, not trusted to APIM: /getPoles isn't scoped per
 * user, so a customer-scoped caller is only ever searched within their own
 * customer, exactly like the web's Poles page. A pole belonging to another
 * customer comes back as `{ pole: null }` — indistinguishable from "doesn't
 * exist", so the response doesn't leak which pole numbers other customers
 * own.
 *
 * PERFORMANCE NOTE: /getPoles has no poleNumber filter today, so a
 * cross-customer caller (Streetleaf staff) pulls the full ~14k-pole summary
 * list (~9MB) per lookup. Fine for a pilot; ask the APIM side for a
 * `poleNumber` filter before rolling out to every crew.
 */
export async function GET(request: NextRequest) {
  const auth = requireSession(request);
  if (!auth.ok) return auth.response;
  const { token, session } = auth;

  const poleNumber = request.nextUrl.searchParams.get("poleNumber")?.trim().toUpperCase() ?? "";
  if (!POLE_NUMBER_PATTERN.test(poleNumber)) {
    return NextResponse.json({ error: "A valid poleNumber is required." }, { status: 400 });
  }

  const customerScoped = isCustomerScoped(session.role, session.customerId);
  if (customerScoped && !session.customerId) {
    return NextResponse.json({ error: "Your account isn't linked to a customer." }, { status: 403 });
  }

  try {
    const poles = await getPoles(
      customerScoped ? { customerId: session.customerId ?? undefined } : undefined,
      token,
    );
    const match = poles.find((pole) => pole.poleNumber.toUpperCase() === poleNumber) ?? null;
    // Belt and braces: never return another customer's pole even if APIM
    // ignored the customerId filter.
    const pole = match && customerScoped && match.customerId !== session.customerId ? null : match;

    const body: PoleLookupResponse = { pole };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApimError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: "Pole lookup failed. Please try again." }, { status: 500 });
  }
}
