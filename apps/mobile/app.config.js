/**
 * Extends app.json with values that shouldn't be committed.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY — the Google Maps SDK for Android key used by
 * the pole page's Location map in development and store builds (Expo Go
 * on Android brings its own). Restrict it in Google Cloud to this app's
 * package name (com.streetleaf.sllights) and signing certificate. iOS uses
 * Apple Maps and needs no key.
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    ],
  ],
});
