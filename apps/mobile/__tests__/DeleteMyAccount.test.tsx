import { Alert, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/(account)/account";
import SignInScreen from "../app/sign-in";
import { useAuth } from "@/auth/AuthProvider";
import { sessionStore } from "@/auth/sessionStore";
import { ApiError } from "@/api/client";
import { UsersListView } from "@/users/UsersListView";
import { fakeApi, futureExp, makeToken, withAuth } from "../test-utils/helpers";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// The testing tools need the install queue that surrounds Account in the app (tested elsewhere).
jest.mock("@/installs/TestingTools", () => ({ TestingTools: () => null }));

async function signIn(id: string, role: string, customerId: string | null = null) {
  const token = makeToken({ sub: id, role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id, name: "Me", email: "me@x.com", role, customerId } });
}

/** Like the app: the screen while signed in, the Sign in screen once signed out. */
function App({ screen: Screen }: { screen: () => React.ReactElement }) {
  const { state } = useAuth();
  if (state.status === "signedIn") return <Screen />;
  if (state.status === "signedOut") return <SignInScreen />;
  return <Text>loading</Text>;
}

/** Presses a button in the most recent Alert. */
const pressAlertButton = async (alert: jest.SpyInstance, text: string) => {
  const buttons = alert.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => unknown }[];
  await act(async () => {
    await buttons.find((b) => b.text === text)?.onPress?.();
  });
};

afterEach(() => jest.restoreAllMocks());

describe("Delete your account (Account screen, any role)", () => {
  it.each([["Streetleaf Crew"], ["User"], ["Customer Owner"]])(
    "%s: asks first, deletes, signs out, and Sign in confirms it",
    async (role) => {
      await signIn("me-1", role, role === "Streetleaf Crew" ? null : "c1");
      const alert = jest.spyOn(Alert, "alert");
      const api = fakeApi({ getMyCustomer: jest.fn().mockResolvedValue({ customer: { id: "c1", name: "Coastal" } }) });
      await render(<App screen={() => <AccountScreen />} />, { wrapper: withAuth(api) });

      await fireEvent.press(await screen.findByRole("button", { name: "Delete your account" }));
      expect(alert).toHaveBeenCalledWith("Delete your account?", expect.stringContaining("can't be undone"), expect.any(Array));
      expect(api.deleteMyAccount).not.toHaveBeenCalled(); // nothing until confirmed

      await pressAlertButton(alert, "Delete my account");
      expect(api.deleteMyAccount).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Your account has been deleted.")).toBeTruthy();
      expect(await sessionStore.load()).toBeNull(); // signed out on the phone
    },
  );

  it("does nothing if cancelled", async () => {
    await signIn("me-1", "Streetleaf Crew");
    const alert = jest.spyOn(Alert, "alert");
    const api = fakeApi();
    await render(<App screen={() => <AccountScreen />} />, { wrapper: withAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Delete your account" }));
    await pressAlertButton(alert, "Cancel");
    expect(api.deleteMyAccount).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete your account" })).toBeTruthy(); // still signed in
  });

  it("stays signed in and explains if the server refuses", async () => {
    await signIn("me-1", "Streetleaf Crew");
    const alert = jest.spyOn(Alert, "alert");
    const api = fakeApi({ deleteMyAccount: jest.fn().mockRejectedValue(new ApiError("User cannot be deleted.", 409)) });
    await render(<App screen={() => <AccountScreen />} />, { wrapper: withAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Delete your account" }));
    await pressAlertButton(alert, "Delete my account");
    await waitFor(() => expect(alert).toHaveBeenLastCalledWith("Couldn't delete your account", "User cannot be deleted."));
    expect(screen.getByRole("button", { name: "Delete your account" })).toBeTruthy();
    expect(await sessionStore.load()).not.toBeNull();
  });
});

describe("Delete my account (your own row in Users)", () => {
  const actions = { reinvite: false, changeRole: false, delete: false, transferOwnership: false };
  const rows = [
    { id: "me-1", name: "Me Owner", email: "me@x.com", roleLabel: "Owner", status: "active", actions: { ...actions, transferOwnership: true } },
    { id: "u2", name: "Pat Other", email: "pat@x.com", roleLabel: "User", status: "active", actions: { ...actions, delete: true } },
  ];

  it("is on your own row only — a Customer Owner can delete themselves straight away", async () => {
    await signIn("me-1", "Customer Owner", "c1");
    const alert = jest.spyOn(Alert, "alert");
    const api = fakeApi({ listUsers: jest.fn().mockResolvedValue({ users: rows }) });
    await render(<App screen={() => <UsersListView />} />, { wrapper: withAuth(api) });

    const mine = await screen.findByLabelText(/^Me Owner,/);
    const theirs = screen.getByLabelText(/^Pat Other,/);
    expect(screen.getAllByRole("button", { name: "Delete my account" })).toHaveLength(1);
    expect(mine).toBeTruthy();
    expect(theirs).toBeTruthy();
    // The other person's row keeps the ordinary Delete, not "Delete my account".
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);

    await fireEvent.press(screen.getByRole("button", { name: "Delete my account" }));
    await pressAlertButton(alert, "Delete my account");
    expect(api.deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(api.deleteUser).not.toHaveBeenCalled(); // never the "delete someone" call for yourself
    expect(await screen.findByText("Your account has been deleted.")).toBeTruthy();
  });
});
