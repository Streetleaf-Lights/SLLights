export function getPageWindow(current: number, total: number, size = 5): number[] {
  let start = Math.max(1, current - Math.floor(size / 2));
  const end = Math.min(total, start + size - 1);
  start = Math.max(1, end - size + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

const navButtonClass =
  "flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink-muted)] disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:bg-[var(--surface-sunken)]";

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 3.5L6 8l4 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5l4 4.5-4 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Ellipsis() {
  return <span className="px-1 text-[12.5px] text-[var(--ink-faint)]">…</span>;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pageWindow = getPageWindow(page, totalPages);
  const showLeadingEllipsis = pageWindow[0] > 1;
  const showTrailingEllipsis = pageWindow[pageWindow.length - 1] < totalPages;

  return (
    <div className="mx-8 mb-6 mt-4 flex items-center justify-center gap-1.5">
      <button
        type="button"
        className={navButtonClass}
        disabled={page === 1}
        onClick={() => onPageChange(1)}
      >
        First (1)
      </button>
      <button
        type="button"
        className={navButtonClass}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon />
        Previous
      </button>

      {showLeadingEllipsis && <Ellipsis />}
      {pageWindow.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`rounded-md border px-3 py-1.5 text-[12.5px] font-medium ${
            p === page
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
          }`}
        >
          {p}
        </button>
      ))}
      {showTrailingEllipsis && <Ellipsis />}

      <button
        type="button"
        className={navButtonClass}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRightIcon />
      </button>
      <button
        type="button"
        className={navButtonClass}
        disabled={page === totalPages}
        onClick={() => onPageChange(totalPages)}
      >
        Last ({totalPages})
      </button>
    </div>
  );
}
