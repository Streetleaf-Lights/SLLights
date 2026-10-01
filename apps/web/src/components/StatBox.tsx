const SIZE_STYLES = {
  lg: {
    box: "rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-2",
    value: "text-[20px] font-semibold leading-tight text-[var(--ink)]",
    label: "text-[11px] uppercase tracking-wide text-[var(--ink-faint)]",
  },
  sm: {
    box: "rounded-md border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-1",
    value: "text-[13px] font-semibold leading-tight text-[var(--ink)]",
    label: "text-[9.5px] uppercase tracking-wide text-[var(--ink-faint)]",
  },
} as const;

export function StatBox({
  value,
  label,
  size = "lg",
}: {
  value: string | number;
  label: string;
  size?: "lg" | "sm";
}) {
  const styles = SIZE_STYLES[size];
  return (
    <div className={`shrink-0 text-center ${styles.box}`} aria-label={`${value} ${label}`}>
      <div className={styles.value}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}
