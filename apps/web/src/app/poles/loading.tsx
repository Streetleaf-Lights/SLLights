import { PageHeader } from "@/components/PageHeader";

/**
 * Shown straight away while the Poles list loads (the first load can take a
 * while for staff — the full pole list comes from APIM), instead of a blank
 * screen. Next.js swaps in the real page when it's ready.
 */
export default function PolesLoading() {
  return (
    <>
      <PageHeader title="Poles" />
      <div role="status" aria-live="polite" className="mx-8">
        <p className="mb-3 text-[12.5px] text-[var(--ink-muted)]">Loading poles… this can take a moment.</p>
        <div aria-hidden="true" className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="h-10 border-b border-[var(--border)] bg-[var(--surface-sunken)]" />
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-[var(--border)] px-4 py-3 last:border-b-0">
              <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-sunken)]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-sunken)]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-sunken)]" />
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-sunken)]" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
