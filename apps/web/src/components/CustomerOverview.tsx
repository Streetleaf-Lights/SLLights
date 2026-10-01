import Link from "next/link";
import { StatBox } from "@/components/StatBox";
import { StatGroup } from "@/components/StatGroup";
import { InactiveBadge } from "@/components/InactiveBadge";
import { withSearchContext } from "@/lib/url";
import { formatPercent, initials } from "@/lib/text";
import type { Customer, CustomerPoleVitals, Project } from "@/lib/types";

/** Combines address, city, state, and zip into one display line, skipping any that are missing. */
export function formatFullAddress(customer: Customer): string | null {
  const cityStateZip = [
    [customer.city, customer.state].filter(Boolean).join(", "),
    customer.zip,
  ]
    .filter(Boolean)
    .join(" ");
  const parts = [customer.address, cityStateZip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * The customer header (avatar/name/address/phone + project count), summary
 * stats, and project list — shared between the customer detail page
 * (/customers/{id}) and the top-level Projects page, which is just this
 * same view scoped to a Customer Admin's own customer, with no drill-down
 * breadcrumb since it's a primary nav destination rather than something
 * reached by searching/browsing.
 */
export function CustomerOverview({
  customer,
  projects,
  vitals,
  custQ,
  poleQ,
  hideConnectedLights = false,
}: {
  customer: Customer;
  projects: Project[];
  vitals: CustomerPoleVitals | undefined;
  custQ?: string;
  poleQ?: string;
  /**
   * Drops "Connected lights" from each project's stat row, keeping just
   * Total lights and Total faults. Always set on the top-level Projects
   * page (only ever visited by a Customer Admin/User, viewing their own
   * customer); set conditionally on the customer detail page, based on
   * whether *the viewer* (not necessarily the customer being viewed) is
   * customer-scoped — a Streetleaf Admin browsing any customer still sees
   * it, a Customer Admin/User doesn't, even on their own customer's page.
   */
  hideConnectedLights?: boolean;
}) {
  const vitalsByProjectId = new Map(vitals?.projects.map((p) => [p.id, p]));

  const addressLine = formatFullAddress(customer);
  const projectCount = projects.length;
  const totalLights = vitals?.totalLights ?? 0;
  const lightsWorking = formatPercent(vitals?.percentWorking);
  const totalFaults = vitals?.totalFaults ?? "—";

  return (
    <>
      <div className="flex h-[88px] items-center justify-between gap-6 border-b border-t border-[var(--border)] bg-[var(--surface)] px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[21px] font-semibold text-[var(--accent)]">
            {initials(customer.name)}
          </div>
          <div>
            <h1 className="flex items-center text-[20px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
              {customer.name}
              {customer.active === false && <InactiveBadge />}
            </h1>
            {addressLine && (
              <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)]">{addressLine}</p>
            )}
            {customer.phone && (
              <p className="mt-0.5 font-mono-data text-[12.5px] text-[var(--ink-muted)]">
                {customer.phone}
              </p>
            )}
          </div>
        </div>
        <StatBox value={projectCount} label={projectCount === 1 ? "Project" : "Projects"} />
      </div>

      <div className="mx-8 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Summary
        </div>
        <StatGroup
          stats={[
            { value: totalLights, label: "Total lights" },
            { value: lightsWorking, label: "Lights working" },
            {
              value: totalFaults,
              label: "Total faults",
              valueClassName: "text-[var(--status-flagged)]",
              href:
                typeof totalFaults === "number" && totalFaults > 0
                  ? `/poles?customerId=${customer.id}&faults=1`
                  : undefined,
            },
          ]}
        />
      </div>

      <div className="mx-8 mb-6 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Projects
        </div>
        {projects.length === 0 ? (
          <p className="text-[12.5px] text-[var(--ink-faint)]">
            No projects on file for this customer yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {projects.map((project) => {
              const projectVitals = vitalsByProjectId.get(project.id);
              const totalFaults = projectVitals?.totalFaults ?? "—";
              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 hover:bg-[var(--surface-sunken)]"
                >
                  <Link
                    href={withSearchContext(
                      `/customers/${customer.id}/projects/${project.id}`,
                      custQ,
                      poleQ,
                    )}
                    className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-[var(--ink)] hover:underline"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                  <span className="shrink-0">
                    <StatGroup
                      size="sm"
                      stats={[
                        { value: projectVitals?.totalLights ?? "—", label: "Total lights" },
                        ...(hideConnectedLights
                          ? []
                          : [
                              {
                                value: projectVitals?.connectedLights ?? "—",
                                label: "Connected lights",
                              },
                            ]),
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
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
