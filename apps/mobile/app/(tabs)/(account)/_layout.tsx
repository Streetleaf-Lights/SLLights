import { Stack } from "expo-router";
import { HeaderBackButton } from "@/ui/HeaderBackButton";
import { colors } from "@/ui/theme";

/** The Account tab's own stack (Account → Users), so the bottom nav stays visible. */
export default function AccountStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="account" options={{ title: "Account" }} />
      <Stack.Screen
        name="users"
        options={({ navigation }) => ({
          title: "Users",
          headerLeft: () => <HeaderBackButton label="Account" onPress={() => navigation.goBack()} />,
        })}
      />
    </Stack>
  );
}
