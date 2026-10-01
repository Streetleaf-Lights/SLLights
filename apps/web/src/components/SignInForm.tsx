"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { homeRouteForRole } from "@/lib/auth-role";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M10.58 10.58a2 2 0 002.83 2.83" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M9.88 4.24A10.9 10.9 0 0112 4c7 0 11 7 11 7a13.2 13.2 0 01-3.22 3.94M6.1 6.1A13.2 13.2 0 001 11s4 7 11 7a10.9 10.9 0 004.24-.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SignInForm() {
  const searchParams = useSearchParams();
  // For debugging only — lets a request specify which customer context to
  // sign in under, via a ?customerId= query param on this page. Omitted
  // from the request entirely for a normal sign-in (no param present).
  const debugCustomerId = searchParams.get("customerId") ?? undefined;

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmedEmail = email.trim();
  const emailError = !(attempted || emailTouched)
    ? null
    : !trimmedEmail
      ? "Email is required."
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? "Enter a valid email address."
        : null;
  const passwordError = attempted && !password ? "Password is required." : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);

    const valid = Boolean(trimmedEmail && EMAIL_PATTERN.test(trimmedEmail) && password);
    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          ...(debugCustomerId ? { customerId: debugCustomerId } : {}),
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(body?.error ?? "Invalid email or password.");
        setSubmitting(false);
        return;
      }

      // The httpOnly session cookie is already set by the route handler at
      // this point. A full navigation (not router.push) is deliberate here:
      // if the destination route was visited earlier in this tab while
      // unauthenticated, Next's client-side Router Cache can hold onto that
      // now-stale (pre-login) result and router.push can silently reuse it,
      // leaving the person stuck looking at the sign-in page despite being
      // genuinely signed in — a fresh tab (no stale cache) navigates fine.
      // A full navigation always hits the server fresh, sidestepping that
      // cache entirely.
      window.location.href = homeRouteForRole(body?.user?.role, body?.user?.customerId);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[360px]" noValidate>
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
        Sign in
      </h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        Streetleaf - Customer Dashboard
      </p>

      <div className="mt-6">
        <label htmlFor="signin-email" className="text-[12px] font-medium text-[var(--ink-muted)]">
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailTouched(true);
          }}
          className={`mt-1.5 w-full rounded-md border px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 ${
            emailError
              ? "border-[var(--status-flagged)] focus:ring-[var(--status-flagged-bg)]"
              : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]"
          }`}
        />
        {emailError && <p className="mt-1 text-[12px] text-[var(--status-flagged)]">{emailError}</p>}
      </div>

      <div className="mt-4">
        <label
          htmlFor="signin-password"
          className="text-[12px] font-medium text-[var(--ink-muted)]"
        >
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="signin-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 pr-10 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 ${
              passwordError
                ? "border-[var(--status-flagged)] focus:ring-[var(--status-flagged-bg)]"
                : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {passwordError && (
          <p className="mt-1 text-[12px] text-[var(--status-flagged)]">{passwordError}</p>
        )}
      </div>

      <div className="mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-[var(--status-flagged)] bg-[var(--status-flagged-bg)] px-3 py-2 text-[12.5px] text-[var(--status-flagged)]"
        >
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-md bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
