import { Alert, Linking } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/(account)/account";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

// The testing tools need the install queue that surrounds this screen in the app; they're tested in TestingTools.test.tsx.
jest.mock("@/installs/TestingTools", () => ({ TestingTools: () => null }));


async function signedInAs(claims: Record<string, unknown>, role: string) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...claims });
  await sessionStore.save({
    token,
    user: { id: "u1", name: "Crew One", email: "crew@streetleaf.com", role, customerId: (claims.customerId as string) ?? null },
  });
}

describe("AccountScreen", () => {
  it("shows the customer the user belongs to, and no 'Can see' row", async () => {
    await signedInAs({ customerId: "c1" }, "Customer Owner");
    const api = fakeApi({ getMyCustomer: jest.fn().mockResolvedValue({ customer: { id: "c1", name: "Coastal Power" } }) });

    await render(<AccountScreen />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByText("Coastal Power")).toBeTruthy();
    expect(screen.getByText("Customer")).toBeTruthy();
    expect(screen.getByText("Crew One")).toBeTruthy();
    expect(screen.queryByText("Can see")).toBeNull();
  });

  it("shows Streetleaf for staff without fetching a customer", async () => {
    await signedInAs({}, "Streetleaf Admin");
    const api = fakeApi();

    await render(<AccountScreen />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByText("Streetleaf")).toBeTruthy();
    expect(api.getMyCustomer).not.toHaveBeenCalled();
  });

  it("says so when the customer can't be loaded", async () => {
    await signedInAs({ customerId: "c1" }, "User");
    const api = fakeApi({ getMyCustomer: jest.fn().mockRejectedValue(new Error("offline")) });

    await render(<AccountScreen />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByText("Couldn't load")).toBeTruthy();
  });

  describe("privacy and account deletion (asked for by Apple)", () => {
    afterEach(() => jest.restoreAllMocks());

    async function renderAccount() {
      await signedInAs({}, "Streetleaf Crew");
      await render(<AccountScreen />, { wrapper: withSignedInAuth(fakeApi()) });
    }

    it("opens the web app's privacy policy", async () => {
      const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      await renderAccount();
      await fireEvent.press(await screen.findByRole("button", { name: "Privacy policy" }));
      expect(open).toHaveBeenCalledWith("https://sllights.test/privacy");
    });


    it("shows the address if the page can't be opened", async () => {
      jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("No browser"));
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
      await renderAccount();
      await fireEvent.press(await screen.findByRole("button", { name: "Privacy policy" }));
      await waitFor(() => expect(alert).toHaveBeenCalledWith("Privacy policy", expect.stringContaining("https://sllights.test/privacy")));
    });
  });
});
