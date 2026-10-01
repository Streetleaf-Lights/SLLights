type Status =
  | "active"
  | "inactive"
  | "pending"
  | "planned"
  | "decommissioned"
  | "flagged"
  | "admin"
  | "editor"
  | "viewer";

const STYLES: Record<Status, { fg: string; bg: string; label: string }> = {
  active: { fg: "var(--status-active)", bg: "var(--status-active-bg)", label: "Active" },
  inactive: {
    fg: "var(--status-decommissioned)",
    bg: "var(--status-decommissioned-bg)",
    label: "Inactive",
  },
  pending: { fg: "var(--status-warning)", bg: "var(--status-warning-bg)", label: "Pending" },
  planned: { fg: "var(--status-planned)", bg: "var(--status-planned-bg)", label: "Planned" },
  decommissioned: {
    fg: "var(--status-decommissioned)",
    bg: "var(--status-decommissioned-bg)",
    label: "Decommissioned",
  },
  flagged: { fg: "var(--status-flagged)", bg: "var(--status-flagged-bg)", label: "Flagged" },
  admin: { fg: "var(--accent-ink)", bg: "var(--accent-soft)", label: "Admin" },
  editor: { fg: "var(--status-planned)", bg: "var(--status-planned-bg)", label: "Editor" },
  viewer: {
    fg: "var(--status-decommissioned)",
    bg: "var(--status-decommissioned-bg)",
    label: "Viewer",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  const style = STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
      style={{ color: style.fg, backgroundColor: style.bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: style.fg }}
        aria-hidden="true"
      />
      {style.label}
    </span>
  );
}
