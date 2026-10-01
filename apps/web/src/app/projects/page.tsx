import { getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { getSessionToken, getSessionUser } from "@/lib/session";
import { CustomerOverview } from "@/components/CustomerOverview";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [sessionUser, token] = await Promise.all([getSessionUser(), getSessionToken()]);
  const customerId = sessionUser?.customerId;
  const customer = customerId ? await getCustomer(customerId, token) : undefined;

  if (!customer) {
    return (
      <p className="px-8 py-6 text-[13px] text-[var(--ink-muted)]">
        We couldn&rsquo;t find a customer associated with your account.
      </p>
    );
  }

  const [projects, vitals] = await Promise.all([
    getProjectsForCustomer(customer.id, token),
    getPoleVitalsForCustomer(customer.id, token),
  ]);

  return (
    <CustomerOverview
      customer={customer}
      projects={projects}
      vitals={vitals}
      hideConnectedLights
    />
  );
}
