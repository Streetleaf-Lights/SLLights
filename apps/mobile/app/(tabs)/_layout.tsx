import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canUseFieldTools, isCustomerScoped } from "@sllights/shared/auth-role";
import { isCrew } from "@sllights/shared/crew-access";
import { useSignedInUser } from "@/auth/AuthProvider";
import { InstallQueueProvider } from "@/installs/InstallQueueProvider";
import { tabBarBottomInset } from "@/ui/tabBar";
import { colors } from "@/ui/theme";

/**
 * Each tab holds its own stack — (home): list → customer → project → pole;
 * (poles): all poles → pole; (scan): scanner → pole; (account): account → users — so the bottom nav stays visible on every screen,
 * each tab keeps its place when you switch, and tapping the current tab
 * returns to its first screen. The pole screen lives in (home,scan) so both
 * stacks share it.
 */
export default function TabsLayout() {
  const { claims } = useSignedInUser();
  const insets = useSafeAreaInsets();
  const homeTitle = isCustomerScoped(claims.role, claims.customerId) ? "Projects" : "Customers";
  // Installs are field work: only Streetleaf Admin and Streetleaf Crew get the tab.
  const showScan = canUseFieldTools(claims.role);

  // Crews are in the field to install, so they start on the Install tab:
  // once, when the signed-in app first opens on the default screen ("/").
  // They can still tap Customers any time; a launch that opens a specific
  // screen is left alone. Everyone else (Streetleaf Admins included) starts
  // on Customers/Projects as before.
  const router = useRouter();
  const pathname = usePathname();
  const startChecked = useRef(false);
  useEffect(() => {
    if (startChecked.current) return;
    startChecked.current = true;
    if (isCrew(claims.role) && pathname === "/") router.replace("/scan");
  }, [claims.role, pathname, router]);

  // The offline install queue runs for the whole signed-in session (not just
  // while the Scan tab is open), so saved installs go out as soon as
  // there's a connection.
  return (
    <InstallQueueProvider>
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
        name="(poles)"
        options={{
          title: "Poles",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(scan)"
        options={{
          title: "Install",
          headerShown: false,
          // href: null removes the tab from the bar entirely.
          ...(showScan ? {} : { href: null }),
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="(account)"
        options={{
          title: "Account",
          // The tab's stack draws its own header.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
    </InstallQueueProvider>
  );
}
