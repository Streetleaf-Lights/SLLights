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
