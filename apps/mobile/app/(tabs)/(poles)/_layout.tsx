import { Stack } from "expo-router";
import { HeaderBackButton } from "@/ui/HeaderBackButton";
import { colors } from "@/ui/theme";

/** The Poles tab's own stack (list → pole), so the bottom nav stays visible. */
export default function PolesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Poles" }} />
      {/* Untitled: the pole number is in the page; back returns to the list. */}
      <Stack.Screen
        name="pole/[customerId]/[projectId]/[poleId]"
        options={({ navigation }) => ({
          title: "",
          headerLeft: () => <HeaderBackButton label="Poles" onPress={() => navigation.goBack()} />,
        })}
      />
    </Stack>
  );
}
