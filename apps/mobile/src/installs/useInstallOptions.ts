import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InstallOptionsResponse } from "@sllights/shared/api-contract";
import { useAuth } from "@/auth/AuthProvider";

const KEY = "streetleaf.installOptions.v1";

export interface InstallOptionsState {
  projects: InstallOptionsResponse["projects"];
  /** When the list was produced by the server; null if there's none yet. */
  updatedAt: string | null;
  /** "live": just fetched. "saved": the copy on this phone (couldn't reach the server). "none": nothing yet. */
  source: "live" | "saved" | "none";
  loading: boolean;
  /** Why the latest fetch failed, when it did. */
  error: string | null;
}

async function readSaved(): Promise<InstallOptionsResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InstallOptionsResponse) : null;
  } catch {
    return null;
  }
}

/**
 * The Install form's projects and stickers, usable out of signal: shows the
 * copy saved on the phone straight away, fetches a fresh one when it can,
 * and saves that for next time. If the fetch fails, the saved copy stays.
 */
export function useInstallOptions() {
  const { api } = useAuth();
  const [state, setState] = useState<InstallOptionsState>({
    projects: [],
    updatedAt: null,
    source: "none",
    loading: true,
    error: null,
  });

  const fetchFresh = useCallback(async (): Promise<Partial<InstallOptionsState>> => {
    try {
      const fresh = await api.getInstallOptions();
      await AsyncStorage.setItem(KEY, JSON.stringify(fresh)).catch(() => undefined);
      return { projects: fresh.projects, updatedAt: fresh.generatedAt, source: "live", loading: false, error: null };
    } catch (err) {
      return { loading: false, error: err instanceof Error ? err.message : "Couldn't update the project list." };
    }
  }, [api]);

  // Saved copy first (instant, works offline), then a fresh one if reachable.
  useEffect(() => {
    let cancelled = false;
    void readSaved().then((saved) => {
      if (cancelled) return;
      if (saved) setState((s) => ({ ...s, projects: saved.projects, updatedAt: saved.generatedAt, source: "saved" }));
      void fetchFresh().then((update) => {
        if (!cancelled) setState((s) => ({ ...s, ...update }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchFresh]);

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const update = await fetchFresh();
    setState((s) => ({ ...s, ...update }));
  }, [fetchFresh]);

  return { ...state, refresh };
}
