/** Shown next to a customer/project/pole name in a page header when that record's `active` flag is false. */
export function InactiveBadge() {
  return (
    <span className="ml-1.5 text-[12px] font-medium text-[var(--status-warning)]">(Inactive)</span>
  );
}
