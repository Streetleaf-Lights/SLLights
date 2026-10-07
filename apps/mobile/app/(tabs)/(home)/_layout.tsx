import { Stack } from "expo-router";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { HeaderBackButton } from "@/ui/HeaderBackButton";
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
        The customer, project and pole screens show their own name in the
        page, so their top bars stay untitled and the back button says where
        it goes: "‹ Customer Search" here (only staff open a customer, from
        the search list); the project and pole screens set theirs to the
        customer / project name once loaded. Until then, a plain arrow.
      */}
      <Stack.Screen
        name="customer/[customerId]"
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => <HeaderBackButton label="Customer Search" onPress={() => navigation.goBack()} />,
        })}
      />
      <Stack.Screen
        name="project/[customerId]/[projectId]"
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => <HeaderBackButton onPress={() => navigation.goBack()} />,
        })}
      />
      <Stack.Screen
        name="project/[customerId]/[projectId]/pole/[poleId]"
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => <HeaderBackButton onPress={() => navigation.goBack()} />,
        })}
      />
      <Stack.Screen name="faults" options={{ title: "Faults" }} />
      <Stack.Screen name="pole/[poleNumber]" options={{ title: "Pole" }} />
    </Stack>
  );
}
