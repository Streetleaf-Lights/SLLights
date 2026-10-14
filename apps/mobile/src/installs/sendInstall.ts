import type { InstallSubmission } from "@sllights/shared/install-submission";
import { ApiError, type ApiClient } from "@/api/client";
import type { SendResult } from "./queue";

/**
 * Sends one queued install to the server, which records it in Airtable.
 * The server answers success both for a new install and for this same
 * install sent again (a reply lost on the way back), so a resend never
 * creates a second record.
 */
export function createSendInstall(api: ApiClient) {
  return async (submission: InstallSubmission): Promise<SendResult> => {
    try {
      await api.submitInstall(submission);
      return { kind: "sent" };
    } catch (err) {
      return sendResultFor(err);
    }
  };
}

/**
 * How a failed send is handled:
 *  - no connection / timeout, 401 (signed out — kept for after sign-in),
 *    408, 429 and 5xx (Airtable busy or unreachable): try again later;
 *  - any other 4xx — including 409 (the pole already has a *different*
 *    install recorded) and 422 (the sticker isn't part of the project any
 *    more): not accepted, kept with the reason for the crew to Retry or
 *    Delete. Never silently dropped.
 */
export function sendResultFor(err: unknown): SendResult {
  if (!(err instanceof ApiError) || err.status === null) {
    return { kind: "retry-later", error: err instanceof Error ? err.message : "Couldn't send." };
  }
  if (err.status === 401 || err.status === 408 || err.status === 429 || err.status >= 500) {
    return { kind: "retry-later", error: err.message };
  }
  return { kind: "rejected", error: err.message };
}
