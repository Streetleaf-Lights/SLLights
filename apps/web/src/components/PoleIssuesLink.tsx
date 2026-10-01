"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PoleIssue } from "@/lib/types";
import { formatTimestamp } from "@/lib/text";
import { parseApimDate } from "@sllights/shared/dates";
import { POLE_ISSUE_TYPES, PROBLEM_DETAILS_MAX_LENGTH } from "@sllights/shared/api-contract";

// Shared with the mobile app's report form so the two can't drift.
const ISSUE_TYPES = POLE_ISSUE_TYPES;

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/** Green for a resolved issue, red for an open one, neutral for anything else. */
function issueStatusClassName(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "text-[var(--status-flagged)]";
  if (normalized === "closed") return "text-[var(--status-active)]";
  return "text-[var(--ink-muted)]";
}


/**
 * Link + modal shown under the pole detail page's Issue Entry card.
 * Label depends on whether this pole has any reported issues: "View or
 * Report Issue" when it does (there's something to view), plain "Report
 * Issue" when it doesn't. Inside the modal, a second "Report Issue" link
 * reveals a small form for actually submitting one — hidden while the
 * form is showing, and shown again after Cancel or a successful submit.
 */
export function PoleIssuesLink({
  poleNumber,
  issues,
}: {
  poleNumber: string;
  issues: PoleIssue[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0]);
  const [problemDetails, setProblemDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // isPending is React's own signal for "this transition hasn't finished
  // yet" — true for as long as the router.refresh() call below is still
  // in flight, and cleared automatically once Next.js has fetched and
  // committed the refreshed server data. Previously this was inferred by
  // comparing issues.length before/after, which is not a reliable signal
  // (there's no guarantee the count changes, or changes only once) and
  // could leave the spinner stuck on indefinitely; isPending is accurate
  // regardless of what the refreshed data actually contains.
  const [isPending, startTransition] = useTransition();

  const hasIssues = issues.length > 0;
  // Latest first.
  const sortedIssues = [...issues].sort(
    (a, b) => parseApimDate(b.dateReported) - parseApimDate(a.dateReported),
  );

  function resetForm() {
    setShowForm(false);
    setIssueType(ISSUE_TYPES[0]);
    setProblemDetails("");
    setFormError(null);
    setSubmitting(false);
  }

  function close() {
    setIsOpen(false);
    resetForm();
  }

  async function handleSubmitIssue() {
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/createpoleissue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poleNumber,
          status: issueType,
          problemDetails: problemDetails.trim(),
        }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 401) {
        // Same reasoning as UsersTable's handlers — an inline error here
        // would be a dead end, since retrying would just fail the same way.
        router.push("/signin");
        router.refresh();
        return;
      }

      if (!res.ok) {
        setFormError(body?.error ?? "Failed to submit the issue. Please try again.");
        return;
      }

      // Success — clear and hide the form, and show a spinner until the
      // transition (the refresh below) actually finishes. router.refresh()
      // re-fetches pole.poleIssues server-side (fetched with no caching),
      // so the new issue appears in the list below once that
      // completes — the same refresh-after-mutate pattern used
      // throughout this app, rather than constructing a synthetic issue
      // object client-side.
      setIssueType(ISSUE_TYPES[0]);
      setProblemDetails("");
      setShowForm(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-4 cursor-pointer text-[12.5px] font-medium text-[var(--accent)] hover:underline"
      >
        {hasIssues ? "View or Report Issue" : "Report Issue"}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pole-issues-title"
            className="w-full max-w-[480px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="pole-issues-title"
              className="text-[16px] font-semibold text-[var(--ink)]"
            >
              Pole Issues
            </h2>

            {!showForm && !isPending && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 cursor-pointer text-[12.5px] font-medium text-[var(--accent)] hover:underline"
              >
                Report Issue
              </button>
            )}

            {!showForm && isPending && (
              <div
                role="status"
                aria-label="Loading"
                className="mt-3 flex items-center gap-2 text-[12.5px] text-[var(--ink-muted)]"
              >
                <SpinnerIcon />
                Updating issue list…
              </div>
            )}

            {showForm && (
              <div className="mt-3 rounded-md border border-[var(--border)] p-3">
                <p className="text-[12.5px] text-[var(--ink-muted)]">
                  Report an issue for{" "}
                  <span className="font-semibold text-[var(--ink)]">{poleNumber}</span>
                </p>

                <fieldset className="mt-3">
                  <legend className="text-[12px] font-medium text-[var(--ink-muted)]">
                    Issue type
                  </legend>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {ISSUE_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 text-[13px] text-[var(--ink)]"
                      >
                        <input
                          type="radio"
                          name="issueType"
                          value={type}
                          checked={issueType === type}
                          onChange={() => setIssueType(type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label
                  htmlFor="issue-problem-details"
                  className="mt-3 block text-[12px] font-medium text-[var(--ink-muted)]"
                >
                  Problem details
                </label>
                <textarea
                  id="issue-problem-details"
                  value={problemDetails}
                  onChange={(e) => setProblemDetails(e.target.value)}
                  maxLength={PROBLEM_DETAILS_MAX_LENGTH}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
                />

                {formError && (
                  <p role="alert" className="mt-2 text-[12px] text-[var(--status-flagged)]">
                    {formError}
                  </p>
                )}

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitIssue}
                    disabled={submitting || !problemDetails.trim()}
                    className="cursor-pointer rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Submit Issue"}
                  </button>
                </div>
              </div>
            )}

            {hasIssues ? (
              <ul className="mt-4 flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
                {sortedIssues.map((issue) => (
                  <li
                    key={issue.issueId}
                    className="rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-[var(--ink)]">
                        {issue.issueId}
                      </span>
                      <span
                        className={`text-[12px] font-medium ${issueStatusClassName(issue.status)}`}
                      >
                        {issue.status}
                      </span>
                    </div>
                    {issue.problemDetails && (
                      <p className="mt-1 text-[12.5px] italic text-[var(--ink-muted)]">
                        {issue.problemDetails}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">
                      Reported {formatTimestamp(issue.dateReported)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
                No issues reported for this pole yet.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="rounded-md border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
