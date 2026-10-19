/**
 * Details shown on the public Privacy Policy (/privacy) and Account Deletion
 * (/account-deletion) pages — the URLs given to the App Store and Google Play.
 *
 * FILL IN BEFORE PUBLISHING: legal-pages.test.tsx fails while any value
 * below is still "TODO", so placeholders can't go live by accident.
 */
export const LEGAL = {
  /** The legal entity responsible for the data, e.g. "Streetleaf, Inc.". */
  companyLegalName: "Streetleaf",
  /** Where privacy questions and deletion requests go, e.g. "privacy@streetleaf.com". */
  contactEmail: "privacy@streetleaf.com",
  /** Postal address for privacy correspondence (one line). */
  postalAddress: "2502 N Rocky Point Dr, Tampa, FL 33607",
  /** Shown as "Last updated" on both pages (YYYY-MM-DD); change when the text changes. */
  lastUpdated: "2026-10-19",
  supportEmail: "support@streetleaf.com",
} as const;

/** Values still to be filled in (empty when ready to publish). */
export function legalPlaceholders(): string[] {
  return Object.entries(LEGAL)
    .filter(([, value]) => value.trim() === "" || value.trim().toUpperCase() === "TODO")
    .map(([key]) => key);
}
