import type { ReactNode } from "react";

export function Toolbar({
  searchPlaceholder,
  resultCount,
  children,
  value,
  onChange,
}: {
  searchPlaceholder: string;
  resultCount?: string;
  children?: ReactNode;
  /** When provided along with onChange, the search input becomes live/controlled. */
  value?: string;
  onChange?: (value: string) => void;
}) {
  const isControlled = onChange !== undefined;

  return (
    <div className="flex items-center justify-between gap-4 px-8 py-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-72 rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed"
            value={isControlled ? value : undefined}
            onChange={isControlled ? (e) => onChange(e.target.value) : undefined}
            disabled={!isControlled}
          />
        </div>
        {resultCount && (
          <span className="text-[12.5px] text-[var(--ink-muted)]">{resultCount}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="cursor-not-allowed rounded-md bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-white opacity-90 shadow-sm"
      title="Stub — wired up once the write endpoint is available"
    >
      {children}
    </button>
  );
}

export function StubNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mx-8 mb-6 flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[12.5px] text-[var(--ink-muted)]">
      <span
        className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: "var(--accent)" }}
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
