import { Suspense } from "react";
import { getCustomer, getPoles, getProjectsForCustomer } from "@/lib/apim";
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
    (!customerScoped || customerId === sessionUser?.customerId);

  if (isFaultsRequest && customerId) {
    const [rawPoles, customer, projects] = await Promise.all([
      projectId ? getPoles({ projectId }, token) : getPoles({ customerId }, token),
      getCustomer(customerId, token),
      getProjectsForCustomer(customerId, token),
    ]);
    // A pole that's never reported, or hasn't reported in 48h+, has no
    // reliable telemetry basis for its fault flag either (same reasoning
    // as the dash shown elsewhere for Unknown/stale poles) — excluded
    // entirely here rather than shown with possibly-stale fault data.
    const faultedPoles = rawPoles.filter(
      (pole) => pole.isPoleFault === true && !isSilentPole(pole.lastUpdate),
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

  const poles = await getPoles(
    customerScoped && sessionUser?.customerId
      ? { customerId: sessionUser.customerId }
      : undefined,
    token,
  );

  return (
    <>
      <PageHeader title="Poles" />
      <Suspense>
        <PolesTable poles={poles} customerScoped={customerScoped} />
      </Suspense>
    </>
  );
}
