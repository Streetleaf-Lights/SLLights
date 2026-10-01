import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignInScreen from "../app/sign-in";
import { ApiError } from "@/api/client";
import { fakeApi, futureExp, makeToken, withAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const user = { id: "u1", name: "Crew One", email: "crew@streetleaf.com", role: "User", customerId: null };

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("Email"), email);
  await fireEvent.changeText(screen.getByLabelText("Password"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInScreen", () => {
  it("asks for both fields before calling the API", async () => {
    const api = fakeApi();
    await render(<SignInScreen />, { wrapper: withAuth(api) });
    await fill("", "");
    expect(await screen.findByText("Enter your email and password.")).toBeTruthy();
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it("signs in with the trimmed email, stores the session and hands the token to the client", async () => {
    const token = makeToken({ sub: "u1", role: "User", exp: futureExp() });
    const api = fakeApi({ signIn: jest.fn().mockResolvedValue({ token, user }) });
    await render(<SignInScreen />, { wrapper: withAuth(api) });

    await fill("  crew@streetleaf.com ", "pw");

    await waitFor(() => expect(api.setToken).toHaveBeenCalledWith(token));
    expect(api.signIn).toHaveBeenCalledWith("crew@streetleaf.com", "pw");
    const SecureStore = jest.requireMock("expo-secure-store");
    expect(JSON.parse(SecureStore.__store.get("sllights.session"))).toEqual({ token, user });
  });

  it("shows the server's message when sign-in fails", async () => {
    const api = fakeApi({ signIn: jest.fn().mockRejectedValue(new ApiError("invalid email or password", 401)) });
    await render(<SignInScreen />, { wrapper: withAuth(api) });
    await fill("a@b.com", "wrong");
    expect(await screen.findByText("invalid email or password")).toBeTruthy();
    expect(api.setToken).not.toHaveBeenCalledWith(expect.any(String));
  });
});
