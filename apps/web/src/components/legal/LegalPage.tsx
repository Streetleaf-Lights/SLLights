import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/** The shared frame of the public legal pages: logo, title, last-updated date, readable text column. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="w-full bg-[var(--bg)] px-4 py-10 sm:py-16">
      <article className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-sm sm:px-10 sm:py-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/streetleaf-logo.png" alt="Streetleaf" className="mb-8 h-8 w-auto" />
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">Last updated {LEGAL.lastUpdated}</p>
        <div className="legal-body mt-8 space-y-6 text-[15px] leading-7 text-[var(--ink)] [&_a]:text-[var(--accent-strong)] [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
        <footer className="mt-12 border-t border-[var(--border)] pt-6 text-sm text-[var(--ink-muted)]">
          <Link href="/privacy">Privacy Policy</Link>
          <span className="mx-2">·</span>
          <Link href="/account-deletion">Account deletion</Link>
          <span className="mx-2">·</span>
          <Link href="/signin">Sign in</Link>
        </footer>
      </article>
    </div>
  );
}
