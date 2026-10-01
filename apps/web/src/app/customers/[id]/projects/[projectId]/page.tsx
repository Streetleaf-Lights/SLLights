import Link from "next/link";
import { getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs, leadingCrumb } from "@/components/Breadcrumbs";
import { StatGroup } from "@/components/StatGroup";
import { ProjectPolesTable } from "@/components/ProjectPolesTable";
import { LocationMap } from "@/components/LocationMap";
import { RemoteControlLink } from "@/components/RemoteControlLink";
import { InactiveBadge } from "@/components/InactiveBadge";
import { withQueryParam, withSearchContext } from "@/lib/url";
import { getSessionToken, getSessionUser, isCustomerScoped } from "@/lib/session";
import { hasLeadsunProducts } from "@/lib/leadsun";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; projectId: string }>;
  searchParams: Promise<{ cust_q?: string; pole_q?: string }>;
}) {
  const { id, projectId } = await params;
  const { cust_q, pole_q } = await searchParams;
  const token = await getSessionToken();
  const [customer, projects, vitals, sessionUser] = await Promise.all([
    getCustomer(id, token),
    getProjectsForCustomer(id, token),
    getPoleVitalsForCustomer(id, token),
    getSessionUser(),
  ]);
  const project = projects.find((p) => p.id === projectId);
  const projectVitals = vitals?.projects.find((p) => p.id === projectId);

  const customersHref = withQueryParam("/customers", "cust_q", cust_q);
  const customerHref = customer
    ? withSearchContext(`/customers/${customer.id}`, cust_q, pole_q)
    : customersHref;

  if (!customer || !project) {
    return (
      <>
        <Breadcrumbs
          items={[
            leadingCrumb(cust_q, pole_q, sessionUser?.role),
            ...(customer ? [{ label: customer.name, href: customerHref }] : []),
          ]}
        />
        <PageHeader title="Project not found" />
        <p className="px-8 py-6 text-[13px] text-[var(--ink-muted)]">
          We couldn&rsquo;t find a project with id{" "}
          <code className="font-mono-data">{projectId}</code>.{" "}
          <Link href={customerHref} className="text-[var(--accent-ink)] hover:underline">
            Back to {customer ? customer.name : "Customers"}
          </Link>
        </p>
      </>
    );
  }

  const totalLights = projectVitals?.totalLights ?? "—";
  const connectedLights = projectVitals?.connectedLights ?? "—";
  const totalFaults = projectVitals?.totalFaults ?? "—";
  // Drives several "hide the cross-customer-only stuff" decisions below:
  // whether this viewer (not necessarily who owns this project — a
  // Streetleaf Admin browsing a Customer Admin's project still counts as
  // not customer-scoped) sees Connected lights in the summary, and the
  // 48h-prefixed/Connected columns on the pole list.
  const viewerIsCustomerScoped = isCustomerScoped(sessionUser?.role, sessionUser?.customerId);

  return (
    <>
      <Breadcrumbs
        items={[
          leadingCrumb(cust_q, pole_q, sessionUser?.role),
          { label: customer.name, href: customerHref },
        ]}
      />

      <div className="flex items-center justify-between gap-6 border-b border-t border-[var(--border)] bg-[var(--surface)] px-8 py-5">
        <div className="flex flex-col justify-center gap-1">
          <p className="flex items-center text-[12.5px] font-medium text-[var(--accent)]">
            {customer.name}
            {customer.active === false && <InactiveBadge />}
          </p>
          <h1 className="flex items-center text-[20px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
            {project.name}
            {project.active === false && <InactiveBadge />}
          </h1>
        </div>
        {project.leadsunProject && hasLeadsunProducts(project.leadsunProject) && (
          <RemoteControlLink projectId={project.id} leadsunProject={project.leadsunProject} />
        )}
      </div>

      <div className="mx-8 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Light Status
        </div>
        <StatGroup
          stats={[
            { value: totalLights, label: "Total lights" },
            ...(viewerIsCustomerScoped
              ? []
              : [{ value: connectedLights, label: "Connected lights" }]),
            {
              value: totalFaults,
              label: "Total faults",
              valueClassName: "text-[var(--status-flagged)]",
              href:
                typeof totalFaults === "number" && totalFaults > 0
                  ? `/poles?customerId=${customer.id}&projectId=${project.id}&faults=1`
                  : undefined,
            },
          ]}
        />
      </div>

      <div className="mx-8 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Location
        </div>
        <LocationMap
          points={(projectVitals?.poles ?? [])
            .filter((pole) => pole.lat != null && pole.long != null)
            .map((pole) => ({ lat: pole.lat as number, long: pole.long as number, label: pole.poleNumber }))}
          emptyMessage="No poles have location data for this project."
        />
      </div>

      <div className="mx-8 mb-6 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Poles
        </div>
        <ProjectPolesTable
          poles={projectVitals?.poles ?? []}
          customerId={customer.id}
          projectId={project.id}
          custQ={cust_q}
          poleQ={pole_q}
          customerScoped={viewerIsCustomerScoped}
          leadsunProject={project.leadsunProject}
        />
      </div>
    </>
  );
}
