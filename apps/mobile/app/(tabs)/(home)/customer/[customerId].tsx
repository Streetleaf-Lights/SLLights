import { useLocalSearchParams } from "expo-router";
import { CustomerOverviewView } from "@/monitoring/CustomerOverviewView";

/**
 * A customer's overview, opened from the staff customer list. The name is
 * already in the page header, so the top bar stays untitled (see the home
 * stack layout) and its back button reads "‹ Customer Search".
 */
export default function CustomerScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  // Only staff reach this screen, so they see the full stats (viewerScoped=false).
  return <CustomerOverviewView customerId={String(customerId)} viewerScoped={false} />;
}
