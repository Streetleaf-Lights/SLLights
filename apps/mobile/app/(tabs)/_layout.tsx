import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { isCustomerScoped, isStreetleafStaff } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { colors } from "@/ui/theme";

export default function TabsLayout() {
  const { claims } = useSignedInUser();
  // Customers land on their own projects; Streetleaf staff on the customer list.
  const homeTitle = isCustomerScoped(claims.role, claims.customerId) ? "Projects" : "Customers";
  // Scanning is field work: only Streetleaf staff (admins and crew) get the tab.
  const showScan = isStreetleafStaff(claims.role, claims.customerId);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.inkMuted,
        headerTintColor: colors.ink,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: homeTitle,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          headerShown: false,
          // href: null removes the tab from the bar entirely.
          ...(showScan ? {} : { href: null }),
          tabBarIcon: ({ color, size }) => <Ionicons name="scan" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
