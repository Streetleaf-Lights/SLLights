/**
 * Bottom padding for the tab bar. React Navigation pads the bar by the full
 * bottom safe-area inset, which on an iPhone with a home indicator (34pt)
 * leaves a gap under the icons about as tall as the icons themselves.
 *
 * Insets up to 34 come from the iOS home indicator or Android gesture
 * navigation, where only a sliver is actually occupied, so we keep half.
 * Larger insets (Android 3-button navigation) are kept in full so the tabs
 * never sit under the system buttons.
 */
export function tabBarBottomInset(inset: number): number {
  return inset > 0 && inset <= 34 ? Math.round(inset / 2) : inset;
}
