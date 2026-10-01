"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Toolbar } from "@/components/Toolbar";
import { Pagination } from "@/components/Pagination";
import {
  connectedTextClassName,
  overallStatusTextClassName,
  panelLabelText,
} from "@/lib/text";
import { withQueryParam } from "@/lib/url";
import type { PoleSummary } from "@/lib/types";

const PAGE_SIZE = 10;

export function PolesTable({
  poles,
  customerScoped = false,
  customerName,
  projectNames,
}: {
  poles: PoleSummary[];
  /**
   * True when the viewer (Customer Admin or "Customer User") is scoped to
   * a single customer — drops "48h Connected" entirely (they're already
   * looking at just their own poles, so it reads as noise) and shortens
   * "48h Overall Status" to "Overall Status". Same behavior as
   * ProjectPolesTable. Light/Panel/Battery/Overall Status values
   * themselves are the API's own pre-computed labels, shown as-is
   * regardless of viewer — no client-side "48H" stripping.
   */
  customerScoped?: boolean;
  /**
   * Set only when arriving via a "Total faults" link (from the customer
   * detail or project detail page), never via the normal left-nav Poles
   * link — adds a leftmost "Customer" column showing this value on every
   * row. Dropped entirely for a customer-scoped viewer, same as the
   * Customer detail page columns elsewhere — they only ever see their own
   * customer, so naming it is redundant.
   */
  customerName?: string;
  /**
   * Same trigger as customerName — keyed by projectId, adds a leftmost
   * "Project" column showing each row's own project name (looked up via
   * that row's projectId). A per-project fault link only ever populates
   * one entry; the customer-level aggregate fault link can span multiple
   * projects, so this needs to be a per-row lookup rather than one
   * constant value. Shown for every viewer (including customer-scoped
   * ones), since a customer can have multiple projects.
   */
  projectNames?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const poleQ = searchParams.get("pole_q") ?? "";
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState(poleQ);
  const [prevPoleQ, setPrevPoleQ] = useState(poleQ);

  // Same render-time state-adjustment pattern used in CustomersTable — see
  // the comment there for why this can't just be a useState initializer.
  if (poleQ !== prevPoleQ) {
    setPrevPoleQ(poleQ);
    setQuery(poleQ);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return poles;
    return poles.filter((pole) => pole.poleNumber.toLowerCase().includes(q));
  }, [poles, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagePoles = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Only present when arriving via a "Total faults" link — never via normal navigation.
  const showProjectColumn = Boolean(projectNames && Object.keys(projectNames).length > 0);
  const showCustomerColumn = showProjectColumn && !customerScoped && Boolean(customerName);

  function handleQueryChange(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <>
      <Toolbar
        searchPlaceholder="Search by pole number…"
        resultCount={`${filtered.length} ${filtered.length === 1 ? "pole" : "poles"}`}
        value={query}
        onChange={handleQueryChange}
      />
      {filtered.length === 0 ? (
        <p className="mx-8 text-[12.5px] text-[var(--ink-faint)]">
          {poles.length === 0 ? "No poles on file yet." : "No poles match your search."}
        </p>
      ) : (
        <>
          <div className="mx-8 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] table-scroll">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-[11.5px] uppercase tracking-wide text-[var(--ink-muted)]">
                  {showCustomerColumn && <th className="py-2.5 pl-4 pr-4 font-medium">Customer</th>}
                  {showProjectColumn && (
                    <th
                      className={`py-2.5 pr-4 font-medium ${showCustomerColumn ? "" : "pl-4"}`}
                    >
                      Project
                    </th>
                  )}
                  <th className={`py-2.5 pr-4 font-medium ${showProjectColumn ? "" : "pl-4"}`}>
                    Pole Number
                  </th>
                  {!customerScoped && (
                    <th className="py-2.5 pr-4 font-medium">48h Connected</th>
                  )}
                  <th className="py-2.5 pr-4 font-medium">
                    {customerScoped ? "Overall Status" : "48h Overall Status"}
                  </th>
                  <th className="py-2.5 pr-4 font-medium">Light</th>
                  <th className="py-2.5 pr-4 font-medium">Panel</th>
                  <th className="py-2.5 pr-8 font-medium">Battery</th>
                </tr>
              </thead>
              <tbody>
                {pagePoles.map((pole) => (
                  <tr
                    key={pole.id}
                    className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-sunken)]"
                  >
                    {showCustomerColumn && <td className="py-3 pl-4 pr-4">{customerName}</td>}
                    {showProjectColumn && (
                      <td className={`py-3 pr-4 ${showCustomerColumn ? "" : "pl-4"}`}>
                        {projectNames?.[pole.projectId] ?? "—"}
                      </td>
                    )}
                    <td
                      className={`py-3 pr-4 font-mono-data text-[12px] font-medium ${showProjectColumn ? "" : "pl-4"}`}
                    >
                      <Link
                        href={withQueryParam(
                          `/customers/${pole.customerId}/projects/${pole.projectId}/poles/${pole.id}`,
                          "pole_q",
                          query,
                        )}
                        className="flex items-center gap-2 text-[var(--ink)] hover:underline"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            pole.isOnline === null
                              ? "bg-[var(--ink-faint)]"
                              : pole.isOnline
                                ? "bg-[var(--status-active)]"
                                : "bg-[var(--status-flagged)]"
                          }`}
                          aria-hidden="true"
                        />
                        {pole.poleNumber}
                      </Link>
                    </td>
                    {!customerScoped && (
                      <td
                        className={`py-3 pr-4 font-medium ${connectedTextClassName(pole.connectedText)}`}
                      >
                        {pole.connectedText ?? "—"}
                      </td>
                    )}
                    <td
                      className={`py-3 pr-4 font-medium ${overallStatusTextClassName(pole.overallStatusText)}`}
                    >
                      {pole.overallStatusText ?? "—"}
                    </td>
                    <td className="py-3 pr-4">{pole.lightStatusText ?? "—"}</td>
                    <td className="py-3 pr-4">{panelLabelText(pole)}</td>
                    <td className="py-3 pr-8">{pole.batteryStatusText ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
