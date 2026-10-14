import { Suspense } from "react";
import { getCustomer, getPoles, getProjectsForCustomer } from "@/lib/apim";
import { crewScope } from "@/lib/crew-scope";
import { getSessionToken, getSessionUser, isCustomerScoped } from "@/lib/session";
import { isSilentPole } from "@/lib/text";
import { PageHeader } from "@/components/PageHeader";
import { PolesTable } from "@/components/PolesTable";

export const dynamic = "force-dynamic";

export default async function PolesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string; faults?: string }>;
}) {
  const { customerId, projectId, faults } = await searchParams;
  const [sessionUser, token] = await Promise.all([getSessionUser(), getSessionToken()]);
  const customerScoped = isCustomerScoped(sessionUser?.role, sessionUser?.customerId);
  // Streetleaf Crew: only poles in active projects with sticker numbers.
  const crew = sessionUser && token ? await crewScope(sessionUser, token) : null;

  // Only set when arriving via a "Total faults" link — the per-project one
  // (customer detail row, or the project detail page itself) includes
  // projectId; the customer-level aggregate one (customer detail Summary
  // box) omits it, scoping to every project for that customer instead.
  // Never set via the normal left-nav Poles link. A customer-scoped viewer
  // can only ever reach this for their own customer; silently fall through
  // to the normal view below if the URL somehow points at a different one
  // (e.g. hand-edited).
  const isFaultsRequest =
    Boolean(customerId) &&
    faults === "1" &&
    (!customerScoped || customerId === sessionUser?.customerId) &&
    (!crew || (crew.customerIds.has(customerId ?? "") && (!projectId || crew.projectIds.has(projectId))));

  const faultsData =
    isFaultsRequest && customerId
      ? await Promise.all([
          projectId ? getPoles({ projectId }, token) : getPoles({ customerId }, token),
          getCustomer(customerId, token),
          getProjectsForCustomer(customerId, token),
        ])
      : null;
  // A projectId that isn't this customer's (e.g. a hand-edited URL) isn't a
  // faults view of this customer: fall through to the normal list, as for a
  // mismatched customerId above.
  if (faultsData && customerId && (!projectId || faultsData[2].some((p) => p.id === projectId))) {
    const [rawPoles, customer, projects] = faultsData;
    // A pole that's never reported, or hasn't reported in 48h+, has no
    // reliable telemetry basis for its fault flag either (same reasoning
    // as the dash shown elsewhere for Unknown/stale poles) — excluded
    // entirely here rather than shown with possibly-stale fault data.
    const faultedPoles = rawPoles.filter(
      (pole) =>
        pole.isPoleFault === true &&
        !isSilentPole(pole.lastUpdate) &&
        // Only this customer's poles (and this project's, if given), whatever APIM returned.
        pole.customerId === customerId &&
        (!projectId || pole.projectId === projectId) &&
        // Crew: only their projects.
        (!crew || crew.projectIds.has(pole.projectId)),
    );
    const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

    return (
      <>
        <PageHeader title="Poles" />
        <Suspense>
          <PolesTable
            poles={faultedPoles}
            customerScoped={customerScoped}
            customerName={customer?.name}
            projectNames={projectNames}
          />
        </Suspense>
      </>
    );
  }

  const allPoles = await getPoles(
    customerScoped && sessionUser?.customerId
      ? { customerId: sessionUser.customerId }
      : undefined,
    token,
  );
  const poles = crew ? allPoles.filter((pole) => crew.projectIds.has(pole.projectId)) : allPoles;

  return (
    <>
      <PageHeader title="Poles" />
      <Suspense>
        <PolesTable poles={poles} customerScoped={customerScoped} />
      </Suspense>
    </>
  );
}
