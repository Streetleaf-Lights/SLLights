import type { BeforeSendEvent } from "@vercel/analytics";

/**
 * Page addresses without anything after "?" or "#". The invitation and
 * password-reset links carry a secret token in the address
 * (/register?token=…, /reset-password?token=…), so analytics must never see
 * the query string: only which page was visited.
 */
export function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Vercel Web Analytics' beforeSend: every event's address, minus query and fragment. */
export function beforeSendAnalytics(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: withoutQuery(event.url) };
}
