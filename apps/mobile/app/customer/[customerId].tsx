import { useCallback } from "react";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { CustomerOverviewView } from "@/monitoring/CustomerOverviewView";

/** A customer's overview, opened from the staff customer list. */
export default function CustomerScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const navigation = useNavigation();
  const setTitle = useCallback((name: string) => navigation.setOptions({ title: name }), [navigation]);
  return (
    <>
      <Stack.Screen options={{ title: "Customer" }} />
      {/* Only staff reach this screen, so they see the full stats (viewerScoped=false). */}
      <CustomerOverviewView customerId={String(customerId)} viewerScoped={false} onLoaded={setTitle} />
    </>
  );
}
