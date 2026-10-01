"use client";

import { useState } from "react";
import Link from "next/link";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const emailError = !(attempted || emailTouched)
    ? null
    : !trimmedEmail
      ? "Email is required."
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? "Enter a valid email address."
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);

    const valid = Boolean(trimmedEmail && EMAIL_PATTERN.test(trimmedEmail));
    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/forgotpassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(body?.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSuccessMessage(body?.message ?? "If that email exists, a reset link has been sent.");
      setSubmitting(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[360px]" noValidate>
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
        Forgot password
      </h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        Enter your email and we&rsquo;ll send you a link to reset your password.
      </p>

      <div className="mt-6">
        <label
          htmlFor="forgot-password-email"
          className="text-[12px] font-medium text-[var(--ink-muted)]"
        >
          Email
        </label>
        <input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={submitting || Boolean(successMessage)}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailTouched(true);
          }}
          className={`mt-1.5 w-full rounded-md border px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            emailError
              ? "border-[var(--status-flagged)] focus:ring-[var(--status-flagged-bg)]"
              : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]"
          }`}
        />
        {emailError && <p className="mt-1 text-[12px] text-[var(--status-flagged)]">{emailError}</p>}
      </div>

      {successMessage && (
        <p
          role="status"
          className="mt-4 rounded-md border border-[var(--status-active)] bg-[var(--status-active-bg)] px-3 py-2 text-[12.5px] text-[var(--status-active)]"
        >
          {successMessage}
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-[var(--status-flagged)] bg-[var(--status-flagged-bg)] px-3 py-2 text-[12.5px] text-[var(--status-flagged)]"
        >
          {formError}
        </p>
      )}

      {!successMessage && (
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Sending…" : "Send Reset Link"}
        </button>
      )}

      <div className="mt-4 text-center">
        <Link
          href="/signin"
          className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
        >
          Back to Sign In
        </Link>
      </div>
    </form>
  );
}
