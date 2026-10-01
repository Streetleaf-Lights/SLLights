export function OnlineIndicator({ isOnline }: { isOnline: boolean | null }) {
  if (isOnline === null) {
    return <span className="text-[var(--ink-faint)]">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        isOnline ? "text-[var(--status-active)]" : "text-[var(--status-flagged)]"
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {isOnline ? "Online" : "Offline"}
    </span>
  );
}
