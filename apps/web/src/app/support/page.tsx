import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Support · Streetleaf",
  description: "Help with the Streetleaf dashboard and the Streetleaf Lights app.",
};

/**
 * Public support page for the Streetleaf dashboard and the Streetleaf Lights
 * app (the Support URL given to the App Store and Google Play). The support
 * email comes from lib/legal.ts.
 */
export default function SupportPage() {
  const email = LEGAL.supportEmail;
  const subject = encodeURIComponent("Streetleaf Lights support");
  return (
    <LegalPage title="Support">
      <p>
        Need help with the Streetleaf dashboard or the <strong>Streetleaf Lights</strong> app? Email us at{" "}
        <a href={`mailto:${email}?subject=${subject}`}>{email}</a>. Please include the email address you sign in with,
        the project or pole number if it&rsquo;s about a specific light, and what you were doing when the problem
        happened.
      </p>

      <h2>Signing in</h2>
      <ul>
        <li>
          <strong>Accounts are by invitation.</strong> Streetleaf, or your organisation&rsquo;s administrator, sends you
          an email invitation. Open it on your phone and choose <em>Set your password</em> to finish.
        </li>
        <li>
          <strong>Forgot your password?</strong> Use <Link href="/forgot-password">Forgot password</Link> (also on the
          app&rsquo;s sign-in screen) and we&rsquo;ll email you a link to reset it.
        </li>
        <li>
          <strong>Invitation or reset link expired?</strong> Ask your administrator to re-send the invitation, or
          request a new reset link.
        </li>
      </ul>

      <h2>Recording installs (field crews)</h2>
      <ul>
        <li>
          <strong>No signal?</strong> Installs are saved on your phone and sent automatically once you&rsquo;re back
          online. Waiting installs are listed at the top of the Install screen.
        </li>
        <li>
          <strong>A project or sticker is missing from the list?</strong> Tap <em>Refresh</em> under the Project field
          while you have signal. A sticker you have already submitted from your phone isn&rsquo;t offered again.
        </li>
        <li>
          <strong>An install shows &ldquo;Not accepted&rdquo;?</strong> The reason is shown with it. Correct it and tap{" "}
          <em>Retry</em>, or contact us if you&rsquo;re unsure.
        </li>
        <li>
          <strong>A barcode won&rsquo;t scan?</strong> Move closer so only one barcode is in the frame, turn on the
          flashlight, or tap <em>Won&rsquo;t scan? Type it instead</em>.
        </li>
      </ul>

      <h2>Camera and location</h2>
      <p>
        The app uses the camera to read barcodes and your location to record where a pole was installed. If you
        declined either, turn it back on in your phone&rsquo;s <strong>Settings</strong> under{" "}
        <strong>Streetleaf Lights</strong>.
      </p>

      <h2>Your data</h2>
      <p>
        See our <Link href="/privacy">Privacy Policy</Link>, or how to{" "}
        <Link href="/account-deletion">delete your account</Link>.
      </p>
    </LegalPage>
  );
}
