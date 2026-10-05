import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** How long the welcome screen stays up on each launch. */
export const WELCOME_DURATION_MS = 5000;

/**
 * Whether this launch's welcome screen has finished. In memory only: every
 * cold start shows the welcome screen again, then moves on to sign-in (or
 * straight to the app when a session is saved). Returning from the
 * background doesn't re-show it — the app isn't relaunched.
 */
interface IntroContextValue {
  done: boolean;
  finish: () => void;
}

const IntroContext = createContext<IntroContextValue | null>(null);

export function IntroProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const finish = useCallback(() => setDone(true), []);
  const value = useMemo(() => ({ done, finish }), [done, finish]);
  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro(): IntroContextValue {
  const ctx = useContext(IntroContext);
  if (!ctx) throw new Error("useIntro must be used inside <IntroProvider>.");
  return ctx;
}
