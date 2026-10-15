import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Streetleaf",
  description: "How Streetleaf handles personal information in the Streetleaf dashboard and the Streetleaf Lights app.",
};

/**
 * Public privacy policy for the Streetleaf dashboard and the Streetleaf Lights
 * mobile app (the URL given to the App Store and Google Play). DRAFT — have it
 * reviewed before publishing; contact details come from lib/legal.ts.
 */
export default function PrivacyPage() {
  const email = LEGAL.contactEmail;
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains how {LEGAL.companyLegalName} (&ldquo;Streetleaf&rdquo;, &ldquo;we&rdquo;) collects and uses
        personal information in the Streetleaf customer dashboard and the <strong>Streetleaf Lights</strong> mobile app
        (together, the &ldquo;Service&rdquo;). The Service is for Streetleaf staff and field crews and for our customers;
        accounts are created by invitation.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address, role and, for customer users, the organisation
          you belong to. Administrators provide this when they invite you; you set your own password.
        </li>
        <li>
          <strong>Installation records (field crews):</strong> when you record a streetlight installation we collect the
          pole number, the solar panel and light head serial numbers, any notes you add, the time you captured it, who
          recorded it, and the <strong>precise location</strong> of your phone at that moment.
        </li>
        <li>
          <strong>Issue reports:</strong> the details you enter when you report a problem with a pole.
        </li>
        <li>
          <strong>Information about lights:</strong> operational data from our streetlights (status, battery, solar
          panel and light readings, location). This describes equipment, not people.
        </li>
      </ul>
      <p>
        <strong>Camera:</strong> the app uses your camera only to read barcodes on equipment labels. No photos or video
        are stored or sent. <strong>Location</strong> is read only while you use the install screen, never in the
        background. We do not use advertising, analytics or tracking tools, and we do not collect your contacts,
        photos, browsing history or health or financial information.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the Service: signing you in, showing the projects and lights you&rsquo;re allowed to see, and
          recording installations and issues.</li>
        <li>To keep accurate records of our installed equipment and its maintenance.</li>
        <li>To manage accounts and access, and to keep the Service secure.</li>
      </ul>
      <p>We do not sell personal information or use it for advertising.</p>

      <h2>Who can see it, and who processes it</h2>
      <ul>
        <li>Streetleaf staff, to operate the Service and our lighting projects.</li>
        <li>
          Your organisation: customer users see their own organisation&rsquo;s projects, lights and related records,
          which can include who recorded an installation.
        </li>
        <li>
          Service providers that host or process data for us under our instructions: Microsoft Azure (our systems and
          APIs), Airtable (installation records), and Vercel (hosting the dashboard). Apple and Google distribute the
          app.
        </li>
        <li>Others only where required by law.</li>
      </ul>

      <h2>Storage and security</h2>
      <p>
        Data is sent over encrypted connections (HTTPS). On your phone, your sign-in is kept in the device&rsquo;s secure
        storage, and installations captured without signal are kept on the device until they have been sent. We keep
        account information while your account is active, and installation and equipment records for as long as
        needed for our business and legal obligations.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can ask us for a copy of your personal information, to correct it, or to delete your account. See{" "}
        <Link href="/account-deletion">how to delete your account</Link>, or contact us at{" "}
        <a href={`mailto:${email}`}>{email}</a>. You can turn off camera or location access in your phone&rsquo;s
        settings at any time; some features will then be unavailable.
      </p>

      <h2>Children</h2>
      <p>The Service is a business tool and is not directed to children under 18.</p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The &ldquo;Last updated&rdquo; date above shows when it last changed; significant
        changes will be communicated through the Service.
      </p>

      <h2>Contact us</h2>
      <p>
        {LEGAL.companyLegalName}
        <br />
        {LEGAL.postalAddress}
        <br />
        <a href={`mailto:${email}`}>{email}</a>
      </p>
    </LegalPage>
  );
}
