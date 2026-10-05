import { useCallback, useEffect, useState } from "react";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "success"; data: T; refreshing: boolean }
  | { status: "error"; message: string };

/**
 * Loads data for a screen, with retry (after an error) and pull-to-refresh
 * (keeps showing the current data while it reloads). `load` should be
 * stable for given inputs — wrap it in useCallback with its dependencies;
 * a new `load` starts a fresh load.
 */
export function useApiQuery<T>(load: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ status: "success", data, refreshing: false }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." }),
      );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  /** Full reload with a spinner (used by "Try again"). */
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  /** Reload in place, keeping current data visible (pull-to-refresh). */
  const refresh = useCallback(() => {
    setState((current) => (current.status === "success" ? { ...current, refreshing: true } : { status: "loading" }));
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry, refresh };
}
