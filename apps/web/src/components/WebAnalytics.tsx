"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSendAnalytics } from "@/lib/analyticsPrivacy";

/**
 * Anonymous page-visit counts (Vercel Web Analytics: no cookies, no personal
 * data). Addresses are sent without their query string, so invitation and
 * password-reset tokens never leave the page — see analyticsPrivacy.ts.
 */
export function WebAnalytics() {
  return <Analytics beforeSend={beforeSendAnalytics} />;
}
