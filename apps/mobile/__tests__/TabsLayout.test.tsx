import { render, screen } from "@testing-library/react-native";
import TabsLayout from "../app/(tabs)/_layout";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// Record each Tabs.Screen's options instead of rendering real navigation.
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  const Tabs = ({ children }: { children: unknown }) => children;
  function TabScreen({ name, options }: { name: string; options: { title: string; href?: null } }) {
    return <Text testID={`tab-${name}`}>{`${options.title}|${options.href === null ? "hidden" : "shown"}`}</Text>;
  }
  Tabs.Screen = TabScreen;
  return { Tabs };
});

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

describe("Tabs", () => {
  it.each([
    ["Streetleaf Admin", null],
    ["User", null], // Streetleaf crew
  ])("show Scan to %s", async (role, customerId) => {
    await signIn(role, customerId);
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-scan")).toHaveTextContent("Scan|shown");
    expect(screen.getByTestId("tab-index")).toHaveTextContent("Customers|shown");
  });

  it.each([
    ["Customer Owner", "c1"],
    ["Customer Admin", "c1"],
    ["User", "c1"], // Customer User
  ])("hide Scan from %s", async (role, customerId) => {
    await signIn(role, customerId);
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-scan")).toHaveTextContent("Scan|hidden");
    expect(screen.getByTestId("tab-index")).toHaveTextContent("Projects|shown");
    expect(screen.getByTestId("tab-account")).toHaveTextContent("Account|shown");
  });
});
