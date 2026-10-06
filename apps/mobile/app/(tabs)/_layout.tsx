import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canUseFieldTools, isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { tabBarBottomInset } from "@/ui/tabBar";
import { colors } from "@/ui/theme";

/**
 * Each tab holds its own stack — (home): list → customer → project → pole;
 * (scan): scanner → pole — so the bottom nav stays visible on every screen,
 * each tab keeps its place when you switch, and tapping the current tab
 * returns to its first screen. The pole screen lives in (home,scan) so both
 * stacks share it.
 */
export default function TabsLayout() {
  const { claims } = useSignedInUser();
  const insets = useSafeAreaInsets();
  const homeTitle = isCustomerScoped(claims.role, claims.customerId) ? "Projects" : "Customers";
  // Scanning is field work: only Streetleaf Admin and Streetleaf Crew get the tab.
  const showScan = canUseFieldTools(claims.role);

  return (
    <Tabs
      // Trim the gap under the icons; see tabBarBottomInset.
      safeAreaInsets={{ bottom: tabBarBottomInset(insets.bottom) }}
      screenOptions={{
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.inkMuted,
        headerTintColor: colors.ink,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: homeTitle,
          // The tab's stack draws its own header.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(scan)"
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
