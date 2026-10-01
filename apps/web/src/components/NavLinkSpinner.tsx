"use client";

import { useEffect, useState } from "react";
import { useLinkStatus } from "next/link";

const SPINNER_DELAY_MS = 2000;

function SpinnerIcon() {
  return (
    <svg
      className="h-3 w-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/**
 * Must be rendered as a descendant of a next/link <Link> — useLinkStatus()
 * only reports pending state for that enclosing Link's own navigation, not
 * page loads in general. Waits SPINNER_DELAY_MS before actually rendering
 * anything, so a fast navigation (the common case, since most of these
 * pages are simple lookups) never flashes a spinner at all — it only shows
 * up once a transition has genuinely been slow.
 */
export function NavLinkSpinner({
  className = "ml-auto text-[var(--sidebar-accent-strong)]",
}: {
  className?: string;
}) {
  const { pending } = useLinkStatus();
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setElapsed(true), SPINNER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [pending]);

  if (!pending || !elapsed) return null;
  return (
    <span role="status" aria-label="Loading" className={className}>
      <SpinnerIcon />
    </span>
  );
}
