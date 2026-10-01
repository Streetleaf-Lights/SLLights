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
  formatPercent,
  formatTimestamp,
  connectionStatus,
  overallStatusTextClassName,
  overallStatusTextWeightClassName,
} from "@/lib/text";
import { findLeadsunProduct } from "@/lib/leadsun";
import { getSessionToken, getSessionUser, isCustomerScoped } from "@/lib/session";

function formatCoordinate(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

function formatVoltage(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value}V`;
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

/** Green "okLabel" when false, red "faultLabel" when true, neutral dash when null/undefined. */
function faultStatus(
  isFault: boolean | null | undefined,
  okLabel: string,
  faultLabel: string,
): { text: string; className: string } {
  if (isFault === null || isFault === undefined) {
    return { text: "—", className: "text-[var(--ink-faint)]" };
  }
  return {
    text: isFault ? faultLabel : okLabel,
    className: isFault ? "text-[var(--status-flagged)]" : "text-[var(--status-active)]",
  };
}

/** Appends the idle reason in parentheses only when the panel is actually Idle — it's not meaningful otherwise. */
function panelStatusText(statusLabel: string | null, idleReason: string | null): string {
  const label = statusLabel ?? "—";
  if (label === "Idle" && idleReason) {
    return `${label} (${idleReason})`;
  }
  return label;
}

// US mainland timezone abbreviations by UTC offset (hours), split by
// whether daylight saving is in effect — the same offset means a
// different zone standard vs. daylight (e.g. -05:00 is Eastern Standard
// in winter, but Central Daylight in summer), so these can't be merged
// into one lookup.
const STANDARD_TIME_ZONES: Record<number, string> = { "-5": "EST", "-6": "CST", "-7": "MST", "-8": "PST" };
const DAYLIGHT_TIME_ZONES: Record<number, string> = { "-4": "EDT", "-5": "CDT", "-6": "MDT", "-7": "PDT" };

/** UTC timestamp (ms) of the nth Sunday of a given month/year — month is 1-indexed. */
function nthSundayOfMonth(year: number, month: number, n: number): number {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  const firstDayOfWeek = new Date(firstOfMonth).getUTCDay(); // 0 = Sunday
  const firstSundayDate = firstDayOfWeek === 0 ? 1 : 1 + (7 - firstDayOfWeek);
  return Date.UTC(year, month - 1, firstSundayDate + (n - 1) * 7);
}

/** US daylight saving runs 2nd Sunday of March through 1st Sunday of November (the rule since 2007). */
function isUsDaylightSaving(year: number, month: number, day: number): boolean {
  const current = Date.UTC(year, month - 1, day);
  return current >= nthSundayOfMonth(year, 3, 2) && current < nthSundayOfMonth(year, 11, 1);
}

/**
 * "Expected ON @ 19:54 EDT" from a sunsetTime like
 * "2026-08-28 19:54:31.130526-04:00" — the hour/minute and UTC offset are
 * read literally from the string's own digits (matching this app's
 * wall-clock convention elsewhere, e.g. formatTimestamp), and the offset
 * is resolved to a US zone abbreviation using the wall-clock date to
 * determine whether daylight saving is in effect. Falls back to a plain
 * "UTC±H" label for a non-mainland-US offset, and to just the time with no
 * zone suffix if the string can't be parsed at all.
 */
function formatSunsetExpectation(sunsetTime: string | null | undefined): string | null {
  if (!sunsetTime) return null;
  const match = sunsetTime.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):\d{2}(?:\.\d+)?([+-]\d{2}):?\d{2}$/,
  );
  if (!match) return null;
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, offsetHourStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const offsetHours = Number(offsetHourStr);
  const time = `${hourStr}:${minuteStr}`;

  const isDst = isUsDaylightSaving(year, month, day);
  const zone =
    (isDst ? DAYLIGHT_TIME_ZONES : STANDARD_TIME_ZONES)[offsetHours] ??
    `UTC${offsetHours >= 0 ? "+" : ""}${offsetHours}`;

  return `Expected ON @ ${time} ${zone}`;
}

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
  // A pole with Unknown connectivity (never reported at all — no isOnline,
  // no lastUpdate) has no reliable telemetry basis for its fault flags or
  // 48h averages either, even though those fields might still hold some
  // real (stale) value — show a dash everywhere on this page rather than a
  // status that may be inconsistent with reality: the header's Overall
  // Status, all 4 cards, and the 48H Average % metrics.
  const isUnknownConnected = connected.text === "Unknown";
  // A "provisioned" (single-channel) pole only has one lamp/battery
  // circuit, not two — any of these three being null (rather than all
  // three, since a pole could plausibly be silent on just one channel's
  // own sensor while still having two circuits) is the signal, since
  // real dual-channel poles always report all three together. Channel 2's
  // metrics are hidden entirely, and channel 1's own labels drop the "1"
  // suffix, since there's no "2" to distinguish it from anymore.
  const isProvisioned =
    pole.lampPower2 === null || pole.batteryElecCurrent2 === null || pole.batteryVoltage2 === null;
  // The 48H Overall Status header uses the API's pre-computed
  // overallStatusText directly — no more faultStatus/isUnknownConnected
  // override here, since the API's label already accounts for whether
  // the pole has reliable telemetry (e.g. "Not Reporting"/"Not Reporting
  // 48H") the same way isUnknownConnected used to compensate for
  // client-side. isUnknownConnected itself is still needed below for the
  // 4 status cards and the 48H Average % metrics, which weren't part of
  // this change.
  function cardFaultStatus(
    isFault: boolean | null | undefined,
    okLabel: string,
    faultLabel: string,
  ) {
    return faultStatus(isUnknownConnected ? null : isFault, okLabel, faultLabel);
  }
  function avgPercentText(value: number | null | undefined): string {
    return isUnknownConnected ? "—" : formatPercent(value);
  }
  const viewerIsCustomerScoped = isCustomerScoped(sessionUser?.role, sessionUser?.customerId);
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
          <StatusBox
            title="Light"
            status={cardFaultStatus(pole.isLedFault, "OK", "Fault")}
            metrics={[
              {
                label: "Operating Status",
                value: pole.lightStatusText ?? "—",
                note:
                  pole.lightStatusText === "OFF" ? formatSunsetExpectation(pole.sunsetTime) : null,
              },
              ...(viewerIsCustomerScoped
                ? []
                : [
                    {
                      label: "48H Average Light %",
                      value: avgPercentText(pole.avgLightPercentage),
                    },
                    {
                      label: isProvisioned ? "Light Power" : "Light Power 1",
                      value: formatNumber(pole.lampPower1),
                    },
                    ...(isProvisioned
                      ? []
                      : [
                          {
                            label: "Light Power 2",
                            value: formatNumber(pole.lampPower2),
                          },
                        ]),
                  ]),
            ]}
          />
          <StatusBox
            title="Panel"
            status={cardFaultStatus(pole.isPanelFault, "OK", "Fault")}
            metrics={[
              {
                label: "Operating Status",
                value: panelStatusText(pole.panelStatusText, pole.panelIdleReason),
              },
              ...(viewerIsCustomerScoped
                ? []
                : [
                    {
                      label: "48H Average Panel %",
                      value: avgPercentText(pole.avgPanelPercentage),
                    },
                    {
                      label: "Panel Voltage",
                      value: formatVoltage(pole.solarBoardVoltage),
                    },
                    {
                      label: "Panel Electric Current",
                      value: formatNumber(pole.solarBoardElecCurrent),
                    },
                  ]),
            ]}
          />
          <StatusBox
            title="Battery"
            status={cardFaultStatus(pole.isBatteryFault, "OK", "Fault")}
            metrics={
              viewerIsCustomerScoped
                ? [
                    { label: "Operating Status", value: pole.batteryStatusText ?? "—" },
                    {
                      label: "Battery Percentage",
                      value: formatNumber(pole.electricCurrentAverage),
                    },
                  ]
                : [
                    { label: "Operating Status", value: pole.batteryStatusText ?? "—" },
                    {
                      label: "48H Average Battery %",
                      value: avgPercentText(pole.avgBatteryPercentage),
                    },
                    {
                      label: "Battery Percentage",
                      value: formatNumber(pole.electricCurrentAverage),
                    },
                    {
                      label: isProvisioned ? "Electric Current" : "Electric Current 1",
                      value: formatNumber(pole.batteryElecCurrent1),
                    },
                    ...(isProvisioned
                      ? []
                      : [
                          {
                            label: "Electric Current 2",
                            value: formatNumber(pole.batteryElecCurrent2),
                          },
                        ]),
                    {
                      label: isProvisioned ? "Battery Voltage" : "Battery Voltage 1",
                      value: formatVoltage(pole.batteryVoltage1),
                    },
                    ...(isProvisioned
                      ? []
                      : [
                          {
                            label: "Battery Voltage 2",
                            value: formatVoltage(pole.batteryVoltage2),
                          },
                        ]),
                  ]
            }
          />
          <StatusBox
            title="Issue Entry"
            // Not cardFaultStatus — isOpenIssueFault isn't derived from
            // the pole's own telemetry the way isLedFault/isPanelFault/
            // isBatteryFault are, so it doesn't become unreliable just
            // because the pole has Unknown connectivity. A real false
            // here means no open issue, full stop, even if the pole has
            // never reported in — shown as-is rather than dashed out.
            status={faultStatus(pole.isOpenIssueFault, "None", "Yes")}
            metrics={[]}
          >
            {/* poleIssues is likewise independent of telemetry/connectivity
                — a list of manually-reported issues, not a derived reading
                — so it's shown regardless of connection status too. ?? []
                guards against an older/inconsistent API response that
                hasn't backfilled this field yet, despite the type saying
                it's always present. */}
            <PoleIssuesLink poleNumber={pole.poleNumber} issues={pole.poleIssues ?? []} />
          </StatusBox>
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
