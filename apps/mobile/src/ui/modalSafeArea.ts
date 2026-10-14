import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Padding that keeps a full-screen Modal's content clear of the system bars.
 *
 * Uses the app's safe-area insets (measured before any modal opens — a
 * SafeAreaView inside a Modal can measure zero on its first opening). On
 * Android a Modal is its own system window, drawn under the status bar
 * (statusBarTranslucent), and the app's inset there isn't always the status
 * bar's height — so Android's own StatusBar.currentHeight is the minimum.
 * The navigation bar is left to Android (the modal isn't drawn under it).
 */
export function useModalSafeArea() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === "android" ? Math.max(insets.top, StatusBar.currentHeight ?? 0) : insets.top;
  return { paddingTop: top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right };
}

/** Modal props that go with useModalSafeArea: under the status bar (so the top padding is right), not the navigation bar. */
export const modalSystemBars = { statusBarTranslucent: true } as const;
