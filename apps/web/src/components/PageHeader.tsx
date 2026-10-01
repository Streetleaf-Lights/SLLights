import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-[88px] items-center justify-between gap-6 border-b border-[var(--border)] px-8">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-[var(--ink)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
