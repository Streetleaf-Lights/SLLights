import { Stack } from "expo-router";
import { colors } from "@/ui/theme";

/** The Scan tab's own stack (scanner → pole), so the bottom nav stays visible. */
export default function ScanStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Titled for the pole screen's back button ("‹ Scan"); its own header is hidden. */}
      <Stack.Screen name="scan" options={{ title: "Scan", headerShown: false }} />
      <Stack.Screen name="pole/[poleNumber]" options={{ title: "Pole" }} />
    </Stack>
  );
}
