/**
 * Extends app.json with values that shouldn't be committed or that vary by
 * deployment.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY — the Google Maps SDK for Android key used by
 * the pole page's Location map in development and store builds (Expo Go
 * on Android brings its own). Restrict it in Google Cloud to this app's
 * package name (com.streetleaf.sllights) and signing certificate. iOS uses
 * Apple Maps and needs no key.
 *
 * APP_LINK_DOMAIN — the web app's domain (e.g. dashboard.streetleaf.com),
 * so emailed invite / password-reset links (https://<domain>/register?token=…,
 * /reset-password?token=…) open this app on phones that have it. The web
 * app must also publish the matching verification files (APPLE_TEAM_ID and
 * ANDROID_SHA256_CERT_FINGERPRINTS there). Unset: links open the web pages.
 */
const APP_LINK_PATHS = ["/register", "/reset-password"];

module.exports = ({ config }) => {
  const domain = process.env.APP_LINK_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return {
    ...config,
    ...(domain
      ? {
          ios: { ...config.ios, associatedDomains: [`applinks:${domain}`] },
          android: {
            ...config.android,
            intentFilters: [
              {
                action: "VIEW",
                autoVerify: true,
                data: APP_LINK_PATHS.map((pathPrefix) => ({ scheme: "https", host: domain, pathPrefix })),
                category: ["BROWSABLE", "DEFAULT"],
              },
            ],
          },
        }
      : {}),
    plugins: [
      ...(config.plugins ?? []),
      [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        },
      ],
    ],
  };
};
