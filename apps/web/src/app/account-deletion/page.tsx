import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Delete your account · Streetleaf",
  description: "How to request deletion of your Streetleaf account and what happens to your data.",
};

/**
 * Public account-deletion page (the URL Google Play's Data safety form asks
 * for, and what Apple expects for accounts). DRAFT — have it reviewed before
 * publishing; contact details come from lib/legal.ts.
 */
export default function AccountDeletionPage() {
  const email = LEGAL.contactEmail;
  const subject = encodeURIComponent("Account deletion request");
  return (
    <LegalPage title="Delete your Streetleaf account">
      <p>
        This page explains how to delete your account for the Streetleaf dashboard and the{" "}
        <strong>Streetleaf Lights</strong> app, and what happens to your information.
      </p>

      <h2>How to delete your account</h2>
      <ul>
        <li>
          <strong>In the Streetleaf Lights app:</strong> go to <strong>Account</strong> and tap{" "}
          <strong>Delete your account</strong>, then confirm.
        </li>
        <li>
          <strong>In the dashboard (administrators):</strong> open <strong>Users</strong>, find your own name, and
          choose <strong>Delete my account</strong> from its actions.
        </li>
      </ul>
      <p>Your account is deleted straight away and you are signed out.</p>
      <p>
        Can&rsquo;t sign in? Email <a href={`mailto:${email}?subject=${subject}`}>{email}</a> from the email address you
        use to sign in, with the subject &ldquo;Account deletion request&rdquo;. We will confirm once your account has
        been deleted, normally within 30 days. If you are a customer user, your organisation&rsquo;s administrator can
        also remove your account from the Users page.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li>Your account: your sign-in, name, email address and role.</li>
        <li>You will no longer be able to sign in to the dashboard or the app.</li>
      </ul>

      <h2>What may be kept</h2>
      <ul>
        <li>
          Records of streetlight installations and issue reports, because they describe equipment we maintain for our
          customers. Where we keep them, we can remove or replace your name and email on request unless we must keep
          them for legal or contractual reasons.
        </li>
        <li>Information we are required to keep by law, for as long as the law requires.</li>
      </ul>
      <p>
        Uninstalling the app removes anything stored on your phone, including installations that were saved but not
        yet sent.
      </p>

      <p>
        For more about how we handle your information, see our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
