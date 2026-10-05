import { useEffect } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { IntroProvider, useIntro } from "@/intro/IntroProvider";
import { colors } from "@/ui/theme";

// Keep the native splash (leaf mark on white, configured in app.json) up
// until we know which screen to show, so there's no blank or spinner frame
// between it and the first real screen.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);
// Expo Go shows its own launch screen and doesn't support customising the
// fade, so only set it in development/store builds (where it applies).
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ duration: 300, fade: true });
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <IntroProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootStack />
        </AuthProvider>
      </IntroProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { state: auth } = useAuth();
  const { done: introDone } = useIntro();
  const ready = auth.status !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  // The native splash is still covering the screen.
  if (!ready) return null;

  const signedIn = auth.status === "signedIn";

  // Stack.Protected redirects automatically whenever these guards change:
  //   every launch      -> welcome (5 s) -> sign-in, or the scanner if a session is saved
  //   sign out / expiry -> sign-in (the welcome isn't repeated until the next launch)
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!introDone}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={introDone && signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="customer/[customerId]" options={{ title: "Customer" }} />
        <Stack.Screen name="project/[customerId]/[projectId]" options={{ title: "Project" }} />
        <Stack.Screen name="pole/[poleNumber]" options={{ title: "Pole" }} />
      </Stack.Protected>
      <Stack.Protected guard={introDone && !signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "fade" }} />
      </Stack.Protected>
    </Stack>
  );
}
