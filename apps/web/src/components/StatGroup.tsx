import Link from "next/link";

export interface Stat {
  value: string | number;
  label: string;
  /** Overrides the default ink color for just this stat's value (e.g. green/red for a working percentage). */
  valueClassName?: string;
  /** When set, the value renders as a link instead of plain text — e.g. "Total faults" linking to a filtered pole list. */
  href?: string;
}

const SIZE_STYLES = {
  lg: {
    box: "p-5",
    column: "px-4",
    value: "text-[20px] font-semibold leading-tight",
    label: "mt-1 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]",
  },
  sm: {
    box: "p-2",
    column: "px-2",
    value: "text-[13px] font-semibold leading-tight",
    label: "mt-0.5 text-[9.5px] uppercase tracking-wide text-[var(--ink-faint)]",
  },
} as const;

export function StatGroup({
  stats,
  size = "lg",
}: {
  stats: Stat[];
  size?: "lg" | "sm";
}) {
  const styles = SIZE_STYLES[size];
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${styles.box}`}
    >
      <div
        className="grid divide-x divide-[var(--border)]"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((stat) =>
          stat.href ? (
            <Link
              key={stat.label}
              href={stat.href}
              className={`block text-center first:pl-0 last:pr-0 ${styles.column}`}
              aria-label={`${stat.value} ${stat.label}`}
            >
              <div
                className={`${styles.value} hover:underline ${stat.valueClassName ?? "text-[var(--accent-ink)]"}`}
              >
                {stat.value}
              </div>
              <div className={styles.label}>{stat.label}</div>
            </Link>
          ) : (
            <div
              key={stat.label}
              className={`text-center first:pl-0 last:pr-0 ${styles.column}`}
              aria-label={`${stat.value} ${stat.label}`}
            >
              <div className={`${styles.value} ${stat.valueClassName ?? "text-[var(--ink)]"}`}>
                {stat.value}
              </div>
              <div className={styles.label}>{stat.label}</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
