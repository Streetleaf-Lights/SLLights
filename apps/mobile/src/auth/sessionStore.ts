import * as SecureStore from "expo-secure-store";
import { decodeSessionToken, getSecondsUntilExpiry } from "@sllights/shared/auth-role";
import type { AuthUser } from "@sllights/shared/types";

const KEY = "sllights.session";

/**
 * The session lives in the iOS Keychain / Android Keystore, never in
 * AsyncStorage. WHEN_UNLOCKED_THIS_DEVICE_ONLY keeps it out of iCloud/device
 * backups, so a restored or cloned phone has to sign in again.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export interface StoredSession {
  token: string;
  /** From the sign-in response: the token itself only carries id/role/customerId. */
  user: AuthUser;
}

/** A stored session is usable only if its token still decodes and hasn't expired. */
export function isUsableSession(value: unknown, nowMs: number = Date.now()): value is StoredSession {
  if (!value || typeof value !== "object") return false;
  const { token, user } = value as Partial<StoredSession>;
  if (typeof token !== "string" || !user || typeof user !== "object") return false;
  if (!decodeSessionToken(token)) return false;
  return getSecondsUntilExpiry(token, nowMs) !== 0;
}

export const sessionStore = {
  async load(): Promise<StoredSession | null> {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isUsableSession(parsed)) return parsed;
    } catch {
      // Corrupt entry — fall through and clear it.
    }
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
    return null;
  },
  save: (session: StoredSession) => SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
};
