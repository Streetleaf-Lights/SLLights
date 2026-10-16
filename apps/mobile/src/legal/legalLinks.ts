import { Alert, Linking } from "react-native";
import { getApiBaseUrl } from "@/config";

/**
 * The public Privacy Policy and Account Deletion pages, served by the web app
 * (the same server the app talks to, EXPO_PUBLIC_API_BASE_URL). Apple asks
 * for the privacy policy to be reachable inside the app, and for a way to
 * start account deletion from it.
 */
export const privacyPolicyUrl = () => `${getApiBaseUrl()}/privacy`;
export const accountDeletionUrl = () => `${getApiBaseUrl()}/account-deletion`;

/** Opens a page in the browser; if that fails, shows the address so it can be typed in. */
export async function openLegalPage(url: string, title: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(title, `Couldn't open the page. You can visit it at:\n${url}`);
  }
}
