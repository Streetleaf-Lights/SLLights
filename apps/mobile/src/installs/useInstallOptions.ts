import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InstallOptionsResponse } from "@sllights/shared/api-contract";
import type { InstallProjectSetup } from "@sllights/shared/install-options";
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

  // Projects set up from this phone, until the server's list confirms it: a
  // refresh that arrives before the backend catches up mustn't flip the
  // screen back to Step 1 (and tempt a second set-up).
  // (Gateways registered here are kept the same way, so Box 3 stays open.)
  const setUpHere = useRef(new Map<string, InstallProjectSetup>());
  const keepSetUp = useCallback((projects: InstallOptionsResponse["projects"]) => {
    return projects.map((p) => {
      const expected = setUpHere.current.get(p.id);
      if (!expected) return p;
      const confirmed = Boolean(p.setup?.leadsunProject) && (p.setup?.gateways.length ?? 0) >= expected.gateways.length;
      if (confirmed) {
        setUpHere.current.delete(p.id); // the server has caught up
        return p;
      }
      return { ...p, setup: expected };
    });
  }, []);

  const fetchFresh = useCallback(async (): Promise<Partial<InstallOptionsState>> => {
    try {
      const fetched = await api.getInstallOptions();
      const fresh = { ...fetched, projects: keepSetUp(fetched.projects) };
      await AsyncStorage.setItem(KEY, JSON.stringify(fresh)).catch(() => undefined);
      return { projects: fresh.projects, updatedAt: fresh.generatedAt, source: "live", loading: false, error: null };
    } catch (err) {
      return { loading: false, error: err instanceof Error ? err.message : "Couldn't update the project list." };
    }
  }, [api, keepSetUp]);

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

  /**
   * After the warehouse sets a project up (or registers its gateway — pass
   * the project's gateways then): mark it so here (and in the copy
   * saved on the phone) straight away, so Step 2 appears without waiting for
   * the refresh that follows.
   */
  const markSetUp = useCallback(
    async (projectId: string, gateways?: InstallProjectSetup["gateways"]) => {
      const mark = (projects: InstallOptionsResponse["projects"]) =>
        projects.map((p) => {
          if (p.id !== projectId) return p;
          const setup = { leadsunProject: true, gateways: gateways ?? p.setup?.gateways ?? [] };
          setUpHere.current.set(projectId, setup);
          return { ...p, setup };
        });
      setState((s) => ({ ...s, projects: mark(s.projects) }));
      // The copy saved on the phone, so it's right offline too.
      const saved = await readSaved();
      if (saved) await AsyncStorage.setItem(KEY, JSON.stringify({ ...saved, projects: mark(saved.projects) })).catch(() => undefined);
    },
    [],
  );

  return { ...state, refresh, markSetUp };
}
