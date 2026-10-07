/**
 * Universal links (iOS) / app links (Android) for the emailed invite and
 * password-reset links, so they open the SLLights app on a phone that has
 * it (the app's screens use the same paths as these web pages). Off until
 * configured: each file 404s while its setting is missing, and the links
 * keep opening the web pages, which work as before.
 */
export const MOBILE_APP_ID = "com.streetleaf.sllights";
/** The emailed-link pages the app also handles. */
export const APP_LINK_PATHS = ["/register", "/reset-password"];

/** iOS: /.well-known/apple-app-site-association, from APPLE_TEAM_ID. */
export function appleAppSiteAssociation(teamId: string | undefined) {
  const team = teamId?.trim();
  if (!team) return null;
  return {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${MOBILE_APP_ID}`],
          components: APP_LINK_PATHS.flatMap((path) => [{ "/": path }, { "/": `${path}/*` }]),
        },
      ],
    },
  };
}

/**
 * Android: /.well-known/assetlinks.json, from ANDROID_SHA256_CERT_FINGERPRINTS
 * (comma-separated SHA-256 fingerprints of every key that signs the app —
 * e.g. the EAS/upload key and the Play App Signing key).
 */
export function androidAssetLinks(fingerprints: string | undefined) {
  const list = (fingerprints ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  if (list.length === 0) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: MOBILE_APP_ID, sha256_cert_fingerprints: list },
    },
  ];
}
