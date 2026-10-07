import { render, screen } from "@testing-library/react-native";
import TabsLayout from "../app/(tabs)/_layout";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// Record each Tabs.Screen's options instead of rendering real navigation.
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  function Tabs({ children, safeAreaInsets }: { children: unknown; safeAreaInsets?: { bottom: number } }) {
    return (
      <>
        <Text testID="tab-bar-bottom-inset">{String(safeAreaInsets?.bottom)}</Text>
        {children}
      </>
    );
  }
  function TabScreen({ name, options }: { name: string; options: { title: string; href?: null } }) {
    return <Text testID={`tab-${name}`}>{`${options.title}|${options.href === null ? "hidden" : "shown"}`}</Text>;
  }
  Tabs.Screen = TabScreen;
  return { Tabs };
});

let mockBottomInset = 34;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockBottomInset }),
}));

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

describe("Tabs", () => {
  it.each([
    ["Streetleaf Admin", null],
    ["Streetleaf Crew", null],
  ])("show Scan to %s", async (role, customerId) => {
    await signIn(role, customerId);
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-(scan)")).toHaveTextContent("Scan|shown");
    expect(screen.getByTestId("tab-(home)")).toHaveTextContent("Customers|shown");
    expect(screen.getByTestId("tab-(poles)")).toHaveTextContent("Poles|shown");
  });

  it.each([
    ["User", null, "Customers"], // Streetleaf User
    ["User", "c1", "Projects"], // Customer User
    ["Customer Owner", "c1", "Projects"],
    ["Customer Admin", "c1", "Projects"],
  ])("hide Scan from %s (customer %s)", async (role, customerId, home) => {
    await signIn(role, customerId);
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-(scan)")).toHaveTextContent("Scan|hidden");
    expect(screen.getByTestId("tab-(home)")).toHaveTextContent(`${home}|shown`);
    expect(screen.getByTestId("tab-(poles)")).toHaveTextContent("Poles|shown");
    expect(screen.getByTestId("tab-account")).toHaveTextContent("Account|shown");
  });

  it("treats a Streetleaf User whose token says customerId: \"\" as Streetleaf (Customers home), still without Scan", async () => {
    const token = makeToken({ sub: "u1", role: "User", customerId: "", exp: futureExp() });
    await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "User", customerId: null } });
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-(home)")).toHaveTextContent("Customers|shown");
    expect(screen.getByTestId("tab-(scan)")).toHaveTextContent("Scan|hidden");
  });

  it.each([
    [34, "17"], // iPhone home indicator: halved
    [24, "12"], // Android gesture navigation: halved
    [48, "48"], // Android 3-button navigation: kept so tabs stay clear of the buttons
    [0, "0"], // no inset (e.g. iPhone SE)
  ])("pads the tab bar by %spt inset -> %s", async (inset, expected) => {
    mockBottomInset = inset;
    await signIn("Streetleaf Admin", null);
    await render(<TabsLayout />, { wrapper: withSignedInAuth(fakeApi()) });
    expect(await screen.findByTestId("tab-bar-bottom-inset")).toHaveTextContent(expected);
  });
});
