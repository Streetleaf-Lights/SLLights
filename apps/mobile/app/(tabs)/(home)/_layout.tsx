import { Stack } from "expo-router";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { colors } from "@/ui/theme";

/**
 * The home tab's own stack (list → customer → project → pole), so the
 * bottom nav stays visible on every screen in it.
 */
export default function HomeStackLayout() {
  const { claims } = useSignedInUser();
  // Staff land on the customer list, titled "Customers". Customers land on
  // their own overview, whose page header already names them, so that top
  // bar stays untitled (the tab itself is still labelled "Projects").
  const homeTitle = isCustomerScoped(claims.role, claims.customerId) ? "" : "Customers";

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: homeTitle }} />
      {/*
        The customer and project screens show their name in the page itself,
        so their top bars stay untitled and the back button says where it goes:
        "‹ Customer Search" here (only staff open a customer, from the search
        list), and the customer's name on a project (set once it loads).
      */}
      <Stack.Screen name="customer/[customerId]" options={{ title: "", headerBackTitle: "Customer Search" }} />
      <Stack.Screen name="project/[customerId]/[projectId]" options={{ title: "" }} />
      <Stack.Screen name="pole/[poleNumber]" options={{ title: "Pole" }} />
    </Stack>
  );
}
