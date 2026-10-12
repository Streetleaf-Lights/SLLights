import type { InstallSubmission } from "@sllights/shared/install-submission";
import { ApiError } from "@/api/client";
import type { SendResult } from "./queue";

/**
 * STUB — there's no install endpoint yet. Treats every install as accepted,
 * so the whole save-offline-then-send flow can be used and tested now. The
 * queue only calls this while the phone is online.
 *
 * When the endpoint exists, replace the body with the real call and map its
 * errors with sendResultFor, e.g.:
 *
 *   try { await api.submitInstall(submission); return { kind: "sent" }; }
 *   catch (err) { return sendResultFor(err); }
 *
 * The server should treat `submission.id` as an idempotency key (a resend
 * of an install it already has is a success), since a reply can be lost
 * after the server has saved it.
 */
export async function sendInstall(submission: InstallSubmission): Promise<SendResult> {
  void submission;
  return { kind: "sent" };
}

/**
 * How a failed send should be handled, for the real endpoint:
 *  - no connection / timeout, 401 (signed out — keep it for after sign-in),
 *    408, 429 and 5xx: retry later;
 *  - 409 (already have this install): done;
 *  - other 4xx (the install itself was refused): rejected, with the reason.
 */
export function sendResultFor(err: unknown): SendResult {
  if (!(err instanceof ApiError) || err.status === null) {
    return { kind: "retry-later", error: err instanceof Error ? err.message : "Couldn't send." };
  }
  if (err.status === 409) return { kind: "sent" };
  if (err.status === 401 || err.status === 408 || err.status === 429 || err.status >= 500) {
    return { kind: "retry-later", error: err.message };
  }
  return { kind: "rejected", error: err.message };
}
