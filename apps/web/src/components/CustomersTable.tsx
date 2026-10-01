"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { NavLinkSpinner } from "@/components/NavLinkSpinner";
import { useSearchParams } from "next/navigation";
import type { Customer } from "@/lib/types";
import { Pagination } from "@/components/Pagination";
import { Toolbar } from "@/components/Toolbar";
import { withQueryParam } from "@/lib/url";

const PAGE_SIZE = 10;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-[var(--ink-faint)] transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function formatLocation(customer: Customer): string {
  if (customer.city && customer.state) return `${customer.city}, ${customer.state}`;
  if (customer.state) return customer.state;
  if (customer.city) return customer.city;
  return "—";
}

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState(() => searchParams.get("cust_q") ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <>
      <Toolbar
        searchPlaceholder="Search customers…"
        resultCount={`${filtered.length} customer${filtered.length === 1 ? "" : "s"}`}
        value={query}
        onChange={handleQueryChange}
      />
      <div className="mx-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-[11.5px] uppercase tracking-wide text-[var(--ink-muted)]">
              <th className="w-8 py-2.5 pl-4"></th>
              <th className="py-2.5 pr-4 font-medium">Customer</th>
              <th className="py-2.5 pr-4 font-medium">Projects</th>
              <th className="py-2.5 pr-4 font-medium">Location</th>
              <th className="py-2.5 pr-8 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody>
            {pageCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">
                  No customers match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              pageCustomers.map((customer) => {
                const isOpen = expanded === customer.id;
                const projects = customer.projects;
                return (
                  <Fragment key={customer.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : customer.id)}
                      className="cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-sunken)]"
                    >
                      <td className="pl-4">
                        <ChevronIcon open={isOpen} />
                      </td>
                      <td className="py-3 pr-4 font-medium text-[var(--ink)]">
                        <Link
                          href={withQueryParam(`/customers/${customer.id}`, "cust_q", query)}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          {customer.name}
                          <NavLinkSpinner className="text-[var(--ink-faint)]" />
                        </Link>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-[var(--ink-muted)]">
                        {projects.length}
                      </td>
                      <td className="py-3 pr-4 text-[var(--ink-muted)]">
                        {formatLocation(customer)}
                      </td>
                      <td className="py-3 pr-8 font-mono-data text-[12px] text-[var(--ink-muted)]">
                        {customer.phone ?? "—"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)]/60">
                        <td colSpan={5} className="px-4 py-3 pl-12">
                          {projects.length === 0 ? (
                            <p className="text-[12.5px] text-[var(--ink-faint)]">
                              No projects on file for this customer yet.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <div className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                                Projects
                              </div>
                              {projects.map((project) => (
                                <div
                                  key={project.id}
                                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                                >
                                  <Link
                                    href={withQueryParam(
                                      `/customers/${customer.id}/projects/${project.id}`,
                                      "cust_q",
                                      query,
                                    )}
                                    className="text-[13px] font-medium text-[var(--ink)] hover:underline"
                                  >
                                    {project.name}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
    </>
  );
}
