import Link from "next/link";
import { getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs, leadingCrumb } from "@/components/Breadcrumbs";
import { CustomerOverview } from "@/components/CustomerOverview";
import { withQueryParam } from "@/lib/url";
import { getSessionToken, getSessionUser, isCustomerScoped } from "@/lib/session";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cust_q?: string; pole_q?: string }>;
}) {
  const { id } = await params;
  const { cust_q, pole_q } = await searchParams;
  const token = await getSessionToken();
  const [customer, sessionUser] = await Promise.all([getCustomer(id, token), getSessionUser()]);
  const customersHref = withQueryParam("/customers", "cust_q", cust_q);

  if (!customer) {
    return (
      <>
        <Breadcrumbs items={[leadingCrumb(cust_q, pole_q, sessionUser?.role)]} />
        <PageHeader title="Customer not found" />
        <p className="px-8 py-6 text-[13px] text-[var(--ink-muted)]">
          We couldn&rsquo;t find a customer with id{" "}
          <code className="font-mono-data">{id}</code>.{" "}
          <Link href={customersHref} className="text-[var(--accent-ink)] hover:underline">
            Back to Customers
          </Link>
        </p>
      </>
    );
  }

  const [projects, vitals] = await Promise.all([
    getProjectsForCustomer(customer.id, token),
    getPoleVitalsForCustomer(customer.id, token),
  ]);

  return (
    <>
      <Breadcrumbs items={[leadingCrumb(cust_q, pole_q, sessionUser?.role)]} />
      <CustomerOverview
        customer={customer}
        projects={projects}
        vitals={vitals}
        custQ={cust_q}
        poleQ={pole_q}
        hideConnectedLights={isCustomerScoped(sessionUser?.role, sessionUser?.customerId)}
      />
    </>
  );
}
