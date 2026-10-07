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
        {/* Every signed-in screen lives inside the tabs (each tab has its own stack). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
      </Stack.Protected>
      <Stack.Protected guard={introDone && !signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: "fade" }} />
      </Stack.Protected>
      {/*
        Signed-out helpers. Not behind the welcome screen, so an emailed
        invite / reset link (same paths as the web pages) that opens the app
        from cold lands straight on its screen instead of being lost to the
        5-second welcome. Signing in (or registering) leaves them by the
        guard above.
      */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
