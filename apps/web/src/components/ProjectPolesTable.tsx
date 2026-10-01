"use client";

import { useState } from "react";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { RemoteControlLink } from "@/components/RemoteControlLink";
import { withSearchContext } from "@/lib/url";
import {
  connectedTextClassName,
  overallStatusTextClassName,
  panelLabelText,
} from "@/lib/text";
import { findLeadsunProduct } from "@/lib/leadsun";
import type { LeadsunProject, PoleVital } from "@/lib/types";

const PAGE_SIZE = 10;

export function ProjectPolesTable({
  poles,
  customerId,
  projectId,
  custQ,
  poleQ,
  customerScoped = false,
  leadsunProject,
}: {
  poles: PoleVital[];
  customerId: string;
  projectId: string;
  custQ?: string;
  poleQ?: string;
  /**
   * True when the viewer (Customer Admin or "Customer User") is scoped to
   * a single customer — drops "48h Connected" entirely (they're already
   * looking at just their own poles, so it reads as noise) and shortens
   * "48h Overall Status" to "Overall Status".
   */
  customerScoped?: boolean;
  /**
   * When a pole's locationId matches a product here, that row gets a
   * Remote Control link in the rightmost "Actions" column. Absent/no
   * match means no link for that row, and if this project has no Leadsun
   * products at all, the column is dropped entirely.
   */
  leadsunProject?: LeadsunProject | null;
}) {
  const [page, setPage] = useState(1);

  if (poles.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        No poles on file for this project yet.
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil(poles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagePoles = poles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showRemoteControlColumn = poles.some(
    (pole) => findLeadsunProduct(leadsunProject, pole.locationId) !== undefined,
  );

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-[11.5px] uppercase tracking-wide text-[var(--ink-muted)]">
              <th className="py-2.5 pl-4 pr-4 font-medium">Pole Number</th>
              {!customerScoped && (
                <th className="py-2.5 pr-4 font-medium">48h Connected</th>
              )}
              <th className="py-2.5 pr-4 font-medium">
                {customerScoped ? "Overall Status" : "48h Overall Status"}
              </th>
              <th className="py-2.5 pr-4 font-medium">Light</th>
              <th className="py-2.5 pr-4 font-medium">Panel</th>
              <th className={`py-2.5 font-medium ${showRemoteControlColumn ? "pr-4" : "pr-8"}`}>
                Battery
              </th>
              {showRemoteControlColumn && (
                <th className="py-2.5 pr-8 font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pagePoles.map((pole) => {
              const leadsunProduct = findLeadsunProduct(leadsunProject, pole.locationId);
              return (
                <tr
                  key={pole.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-sunken)]"
                >
                  <td className="py-3 pl-4 pr-4 font-mono-data text-[12px] font-medium">
                    <Link
                      href={withSearchContext(
                        `/customers/${customerId}/projects/${projectId}/poles/${pole.id}`,
                        custQ,
                        poleQ,
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
                  <td className={`py-3 ${showRemoteControlColumn ? "pr-4" : "pr-8"}`}>
                    {pole.batteryStatusText ?? "—"}
                  </td>
                  {showRemoteControlColumn && (
                    <td className="py-3 pr-8">
                      {leadsunProduct && leadsunProject && (
                        <RemoteControlLink
                          projectId={projectId}
                          leadsunProject={leadsunProject}
                          product={leadsunProduct}
                        />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
