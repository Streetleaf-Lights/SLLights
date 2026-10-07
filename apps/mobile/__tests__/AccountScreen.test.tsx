import { render, screen } from "@testing-library/react-native";
import AccountScreen from "../app/(tabs)/(account)/account";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

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
});
