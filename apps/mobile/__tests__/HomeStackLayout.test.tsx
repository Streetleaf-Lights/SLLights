import { render, screen } from "@testing-library/react-native";
import HomeStackLayout from "../app/(tabs)/(home)/_layout";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

// Record each Stack.Screen's options instead of rendering real navigation.
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  function Stack({ children }: { children: unknown }) {
    return <>{children}</>;
  }
  function StackScreen({ name, options }: { name: string; options: Record<string, unknown> }) {
    return <Text testID={`screen-${name}`}>{JSON.stringify(options)}</Text>;
  }
  Stack.Screen = StackScreen;
  return { Stack };
});

const optionsOf = (name: string) => JSON.parse(String(screen.getByTestId(`screen-${name}`).props.children));

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

describe("home tab stack", () => {
  it("leaves the customer top bar untitled, with back reading 'Customer Search'", async () => {
    await signIn("Streetleaf Admin", null);
    await render(<HomeStackLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    await screen.findByTestId("screen-index");
    expect(optionsOf("customer/[customerId]")).toEqual({ title: "", headerBackTitle: "Customer Search" });
  });

  it("leaves the project top bar untitled (its back button gets the customer name once loaded)", async () => {
    await signIn("Streetleaf Admin", null);
    await render(<HomeStackLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    await screen.findByTestId("screen-index");
    expect(optionsOf("project/[customerId]/[projectId]")).toEqual({ title: "" });
    expect(optionsOf("project/[customerId]/[projectId]/pole/[poleId]")).toEqual({ title: "" });
  });

  it.each([
    ["Streetleaf Admin", null, "Customers"],
    ["Customer Owner", "c1", ""], // untitled: the overview's own header names the customer
    ["Customer Admin", "c1", ""],
    ["User", "c1", ""],
  ])("titles the first screen for %s (customer %s) as %j", async (role, customerId, title) => {
    await signIn(role, customerId);
    await render(<HomeStackLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(optionsOf("index")).toMatchObject({ title });
    await screen.findByTestId("screen-index");
  });
});
