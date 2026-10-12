import { Stack } from "expo-router";
import { colors } from "@/ui/theme";

/** The Scan tab's own stack (the install form; the pole screen is still routable here), so the bottom nav stays visible. */
export default function ScanStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="scan" options={{ title: "New Install" }} />
      <Stack.Screen name="pole/[poleNumber]" options={{ title: "Pole" }} />
    </Stack>
  );
}
