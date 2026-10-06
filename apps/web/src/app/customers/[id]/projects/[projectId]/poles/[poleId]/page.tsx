import { Fragment } from "react";
import Link from "next/link";
import { getCustomer, getPoleVitalsForCustomer, getProjectsForCustomer } from "@/lib/apim";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs, leadingCrumb } from "@/components/Breadcrumbs";
import { PoleMap } from "@/components/PoleMap";
import { PoleVitalsChart } from "@/components/PoleVitalsChart";
import { RemoteControlLink } from "@/components/RemoteControlLink";
import { PoleIssuesLink } from "@/components/PoleIssuesLink";
import { InactiveBadge } from "@/components/InactiveBadge";
import { withQueryParam, withSearchContext } from "@/lib/url";
import {
  formatTimestamp,
  connectionStatus,
  overallStatusTextClassName,
  overallStatusTextWeightClassName,
} from "@/lib/text";
// The status cards' rules (role, single-channel, Unknown-connectivity
// dashes, sunset note) live in @sllights/shared so the mobile pole screen
// shows exactly the same thing.
import { buildPoleStatusCards, formatCoordinate } from "@sllights/shared/pole-detail";
import type { StatusTone } from "@sllights/shared/status";
import { findLeadsunProduct } from "@/lib/leadsun";
import { getSessionToken, getSessionUser, isCustomerScoped } from "@/lib/session";

/** Shared status tones -> this app's colour classes. */
const TONE_CLASS: Record<StatusTone, string> = {
  active: "text-[var(--status-active)]",
  flagged: "text-[var(--status-flagged)]",
  muted: "text-[var(--ink-muted)]",
  faint: "text-[var(--ink-faint)]",
};

function StatusBox({
  title,
  status,
  metrics,
  children,
}: {
  title: string;
  status: { text: string; className: string };
  metrics: { label: string; value: string; note?: string | null }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-[var(--ink)]">{title}</span>
        <span className={`text-[13px] font-semibold ${status.className}`}>{status.text}</span>
      </div>
      {metrics.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {metrics.map((metric) => (
            <Fragment key={metric.label}>
              <div className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="text-[var(--ink-faint)]">{metric.label}</span>
                <span className="font-mono-data text-[var(--ink-muted)]">{metric.value}</span>
              </div>
              {metric.note && (
                <div className="-mt-1 text-right text-[12px] text-[var(--ink-muted)]">
                  {metric.note}
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

export default async function PoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; projectId: string; poleId: string }>;
  searchParams: Promise<{ cust_q?: string; pole_q?: string }>;
}) {
  const { id, projectId, poleId } = await params;
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
  const pole = projectVitals?.poles.find((p) => p.id === poleId);

  const customersHref = withQueryParam("/customers", "cust_q", cust_q);
  const customerHref = customer
    ? withSearchContext(`/customers/${customer.id}`, cust_q, pole_q)
    : customersHref;
  const projectHref =
    customer && project
      ? withSearchContext(`/customers/${customer.id}/projects/${project.id}`, cust_q, pole_q)
      : customerHref;

  if (!customer || !project || !pole) {
    return (
      <>
        <Breadcrumbs
          items={[
            leadingCrumb(cust_q, pole_q, sessionUser?.role),
            ...(customer ? [{ label: customer.name, href: customerHref }] : []),
            ...(customer && project ? [{ label: project.name, href: projectHref }] : []),
          ]}
        />
        <PageHeader title="Pole not found" />
        <p className="px-8 py-6 text-[13px] text-[var(--ink-muted)]">
          We couldn&rsquo;t find a pole with id <code className="font-mono-data">{poleId}</code>.{" "}
          <Link href={projectHref} className="text-[var(--accent-ink)] hover:underline">
            Back to {project ? project.name : customer ? customer.name : "Customers"}
          </Link>
        </p>
      </>
    );
  }

  const connected = connectionStatus(pole.isOnline, pole.lastUpdate);
  const viewerIsCustomerScoped = isCustomerScoped(sessionUser?.role, sessionUser?.customerId);
  const statusCards = buildPoleStatusCards(pole, viewerIsCustomerScoped);
  const leadsunProduct = findLeadsunProduct(project.leadsunProject, pole.locationId);

  return (
    <>
      <Breadcrumbs
        items={[
          leadingCrumb(cust_q, pole_q, sessionUser?.role),
          { label: customer.name, href: customerHref },
          { label: project.name, href: projectHref },
        ]}
      />

      <div className="border-b border-t border-[var(--border)] bg-[var(--surface)] px-8 py-5">
        <p className="flex items-center text-[12.5px] font-medium text-[var(--accent)]">
          {project.name}
          {project.active === false && <InactiveBadge />}
        </p>
        <h1 className="mt-0.5 flex items-center font-mono-data text-[20px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
          {pole.poleNumber}
          {pole.active === false && <InactiveBadge />}
        </h1>
        <div className="mt-3 flex items-start gap-8 text-[12.5px] text-[var(--ink-muted)]">
          <div className="flex flex-col gap-1">
            <span>
              <span className="text-[var(--ink-faint)]">Last Update:</span>{" "}
              {formatTimestamp(pole.lastUpdate)}
            </span>
            <span>
              <span className="text-[var(--ink-faint)]">Install Date:</span>{" "}
              {pole.installDate ?? "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span>
              <span className="text-[var(--ink-faint)]">Lat:</span> {formatCoordinate(pole.lat)}
            </span>
            <span>
              <span className="text-[var(--ink-faint)]">Long:</span> {formatCoordinate(pole.long)}
            </span>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected.className.replace("text-", "bg-")}`}
                aria-hidden="true"
              />
              <span className={`text-[13px] font-semibold ${connected.className}`}>
                {connected.text}
              </span>
            </span>
            {!viewerIsCustomerScoped && (
              <span>
                <span className="text-[var(--ink-faint)]">48H Overall Status:</span>{" "}
                <span
                  className={`${overallStatusTextWeightClassName(pole.overallStatusText)} ${overallStatusTextClassName(pole.overallStatusText)}`}
                >
                  {pole.overallStatusText ?? "—"}
                </span>
              </span>
            )}
          </div>
          {leadsunProduct && project.leadsunProject && (
            <div className="flex items-center">
              <RemoteControlLink
                projectId={project.id}
                leadsunProject={project.leadsunProject}
                product={leadsunProduct}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-8 mb-6 mt-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Statuses
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          {statusCards.map((card) => (
            <StatusBox
              key={card.id}
              title={card.title}
              status={{ text: card.status.text, className: TONE_CLASS[card.status.tone] }}
              metrics={card.metrics}
            >
              {/* poleIssues is independent of telemetry/connectivity, so it's
                  always shown. ?? [] guards against an older API response
                  that hasn't backfilled this field yet. */}
              {card.id === "issues" && (
                <PoleIssuesLink poleNumber={pole.poleNumber} issues={pole.poleIssues ?? []} />
              )}
            </StatusBox>
          ))}
        </div>
      </div>

      <div className="mx-8 mb-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Vitals History
        </div>
        <PoleVitalsChart poleId={pole.id} />
      </div>

      <div className="mx-8 mb-6">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          Location
        </div>
        <PoleMap lat={pole.lat} long={pole.long} />
      </div>
    </>
  );
}
