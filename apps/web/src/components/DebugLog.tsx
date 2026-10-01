"use client";

import { useEffect } from "react";

/**
 * Drop this into any Server Component page, passing whatever value you
 * want to inspect — it logs it to the browser's console once mounted.
 * Renders nothing.
 *
 * This exists because a Server Component's own console.log runs on the
 * server, never the browser — this component is a client boundary
 * specifically so the value crosses over and gets logged where DevTools
 * can actually see it. Works the same whether the page is running
 * locally or in production; it's a debugging aid, not an environment
 * check, so remove the <DebugLog> usage once you've seen what you needed.
 *
 * Logs once on mount only (deliberately ignoring changes to label/data
 * after that) — this is a one-shot "what did this return" check, not a
 * live tracker, and re-logging on every re-render would be noisy for
 * data that's a new array/object reference on each server render even
 * when its contents haven't meaningfully changed.
 */
export function DebugLog({ label, data }: { label: string; data: unknown }) {
  useEffect(() => {
    console.log(`[DebugLog] ${label}:`, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
