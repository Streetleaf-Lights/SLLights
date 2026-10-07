/**
 * Links that open a pole's location in the phone's own maps app, labelled
 * with the pole number — for getting directions to it.
 *  - iOS: Apple Maps (https://maps.apple.com URL, handled by the Maps app).
 *  - Android: a geo: URI, which offers the user's maps app (Google Maps etc.).
 *  - Fallback (if the first can't be opened): Google Maps on the web.
 */
export function nativeMapsUrl(platform: string, lat: number, long: number, label: string): string {
  const q = encodeURIComponent(label);
  return platform === "ios"
    ? `https://maps.apple.com/?ll=${lat},${long}&q=${q}`
    : `geo:${lat},${long}?q=${lat},${long}(${q})`;
}

export function webMapsUrl(lat: number, long: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${long}`;
}
