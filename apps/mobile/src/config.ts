/**
 * Base URL of the deployed SLLights web app (NOT the APIM gateway — see
 * @sllights/shared/api-contract for why). Set EXPO_PUBLIC_API_BASE_URL in
 * apps/mobile/.env (copy .env.example). Expo inlines EXPO_PUBLIC_* values at
 * build time, so this is fine for a URL and must never hold a secret.
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!url) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL isn't set. Copy apps/mobile/.env.example to .env.");
  }
  return url.replace(/\/+$/, "");
}

/**
 * Dev-only: set EXPO_PUBLIC_HOLD_WELCOME=1 in apps/mobile/.env to keep the
 * welcome screen up instead of auto-advancing after 5 s (for reviewing its
 * design). Ignored in release builds (__DEV__ is false), so it can't ship
 * by accident. Remove the line and restart with `npx expo start -c` to
 * resume the normal behaviour.
 */
export function isWelcomeHeld(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_HOLD_WELCOME === "1";
}
