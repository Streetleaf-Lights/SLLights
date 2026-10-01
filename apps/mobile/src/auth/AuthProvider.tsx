import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { decodeSessionToken, getSecondsUntilExpiry } from "@sllights/shared/auth-role";
import type { AuthUser, SessionUser } from "@sllights/shared/types";
import { createApiClient, type ApiClient } from "@/api/client";
import { getApiBaseUrl } from "@/config";
import { sessionStore, type StoredSession } from "./sessionStore";

type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: AuthUser; claims: SessionUser };

interface AuthContextValue {
  state: AuthState;
  api: ApiClient;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  apiOverride,
}: {
  children: ReactNode;
  /** Tests inject a fake client; the app builds the real one. */
  apiOverride?: ApiClient;
}) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo(() => apiOverride ?? createApiClient({ baseUrl: getApiBaseUrl() }), [apiOverride]);

  const clearLocal = useCallback(async () => {
    api.setToken(null);
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    setState({ status: "signedOut" });
    await sessionStore.clear().catch(() => undefined);
  }, [api]);

  // Any 401 means APIM no longer accepts this token: drop the session, which
  // Stack.Protected turns into a redirect to sign-in.
  useEffect(() => api.onUnauthorized(() => void clearLocal()), [api, clearLocal]);

  const activate = useCallback(
    (session: StoredSession) => {
      const claims = decodeSessionToken(session.token);
      if (!claims) return void clearLocal();
      api.setToken(session.token);
      setState({ status: "signedIn", user: session.user, claims });

      // Sign out the moment the token expires, rather than on the next failed call.
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const seconds = getSecondsUntilExpiry(session.token);
      if (seconds !== null) {
        // setTimeout overflows past ~24.8 days; tokens are far shorter.
        expiryTimer.current = setTimeout(() => void clearLocal(), Math.min(seconds * 1000, 2 ** 31 - 1));
      }
    },
    [api, clearLocal],
  );

  useEffect(() => {
    let cancelled = false;
    sessionStore
      .load()
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        if (stored) activate(stored);
        else setState({ status: "signedOut" });
      });
    return () => {
      cancelled = true;
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [activate]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.signIn(email, password);
      const session = { token, user };
      await sessionStore.save(session);
      activate(session);
    },
    [api, activate],
  );

  const signOut = useCallback(async () => {
    // Tell APIM first (while we still hold the token), but never let a
    // failure there keep someone signed in on the device.
    await api.signOut().catch(() => undefined);
    await clearLocal();
  }, [api, clearLocal]);

  const value = useMemo(() => ({ state, api, signIn, signOut }), [state, api, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

/** For screens behind Stack.Protected, where a session is guaranteed. */
export function useSignedInUser(): { user: AuthUser; claims: SessionUser } {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useSignedInUser used outside the signed-in area.");
  return { user: state.user, claims: state.claims };
}
