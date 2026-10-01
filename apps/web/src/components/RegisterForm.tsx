"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { homeRouteForRole } from "@/lib/auth-role";

const SPECIAL_CHAR_PATTERN = /[^A-Za-z0-9]/;
const MIN_LENGTH = 8;

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

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
    </svg>
  );
}

function RuleRow({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-[12px] ${
        met ? "text-[var(--status-active)]" : "text-[var(--ink-faint)]"
      }`}
    >
      {met ? <CheckIcon /> : <DotIcon />}
      {children}
    </li>
  );
}

export function RegisterForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasMinLength = password.length >= MIN_LENGTH;
  const hasSpecialChar = SPECIAL_CHAR_PATTERN.test(password);
  const passwordValid = hasMinLength && hasSpecialChar;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const showMatchStatus = attempted || confirmTouched;
  const confirmError =
    showMatchStatus && confirmPassword.length > 0 && !passwordsMatch
      ? "Passwords do not match."
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);

    if (!inviteToken) {
      setFormError("This invite link is invalid or missing. Please request a new one.");
      return;
    }
    if (!passwordValid || !passwordsMatch) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/registeruser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken, password }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setFormError(body?.error ?? "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // The httpOnly session cookie is already set by the route handler at
      // this point. A full navigation (not router.push) is deliberate — see
      // the same comment in SignInForm for why: router.push can silently
      // reuse a stale pre-login Router Cache entry for the destination
      // route, leaving the person stuck looking at this page despite being
      // genuinely signed in.
      window.location.href = homeRouteForRole(body?.user?.role, body?.user?.customerId);
    } catch {
      setFormError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[360px]" noValidate>
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--ink)]">
        Set your password
      </h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Streetleaf - Customer Dashboard</p>

      <div className="mt-6">
        <label
          htmlFor="register-password"
          className="text-[12px] font-medium text-[var(--ink-muted)]"
        >
          Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 pr-10 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 ${
              attempted && !passwordValid
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

        <ul className="mt-2 space-y-1">
          <RuleRow met={hasMinLength}>At least 8 characters</RuleRow>
          <RuleRow met={hasSpecialChar}>At least 1 special character</RuleRow>
        </ul>
      </div>

      <div className="mt-4">
        <label
          htmlFor="register-confirm-password"
          className="text-[12px] font-medium text-[var(--ink-muted)]"
        >
          Confirm Password
        </label>
        <div className="relative mt-1.5">
          <input
            id="register-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmTouched(true);
            }}
            className={`w-full rounded-md border px-3 py-2 pr-10 text-[13px] text-[var(--ink)] focus:outline-none focus:ring-2 ${
              confirmError
                ? "border-[var(--status-flagged)] focus:ring-[var(--status-flagged-bg)]"
                : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent-soft)]"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
          >
            {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {confirmPassword.length > 0 &&
          (passwordsMatch ? (
            <p className="mt-1 text-[12px] text-[var(--status-active)]">Passwords match.</p>
          ) : (
            showMatchStatus && (
              <p className="mt-1 text-[12px] text-[var(--status-flagged)]">
                Passwords do not match.
              </p>
            )
          ))}
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
        {submitting ? "Setting password…" : "Set Password"}
      </button>
    </form>
  );
}
