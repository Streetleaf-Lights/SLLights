import { Text } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter as renderRouterSync } from "expo-router/testing-library";
import * as RootLayout from "../app/_layout";
import * as ForgotPassword from "../app/forgot-password";
import * as Register from "../app/register";
import * as ResetPassword from "../app/reset-password";
import * as SignIn from "../app/sign-in";
import * as Welcome from "../app/welcome";
import { futureExp, makeToken } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

/** expo-router's renderRouter predates RNTL 14's async render — await it, keep its helpers. */
async function renderRouter(...args: Parameters<typeof renderRouterSync>) {
  const result = renderRouterSync(...args);
  await (result as unknown as Promise<unknown>);
  return { getPathname: () => result.getPathname(), getSegments: () => result.getSegments() };
}

/** The real root layout (splash, welcome, auth guards) with the signed-out screens and a stub app. */
const routes = {
  _layout: RootLayout,
  welcome: Welcome,
  "sign-in": SignIn,
  "forgot-password": ForgotPassword,
  "reset-password": ResetPassword,
  register: Register,
  "(tabs)/_layout": () => <Text>The app</Text>,
  "(tabs)/index": () => <Text>Home</Text>,
};

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("emailed links open the right screen, even from a cold start", () => {
  it("lands straight on Set your password (not the welcome screen) and signs in on completion", async () => {
    const token = makeToken({ sub: "u1", role: "User", customerId: "c1", exp: futureExp() });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token, user: { id: "u1", name: "Nia", email: "nia@c.com", role: "User", customerId: "c1" } }),
    });

    const router = await renderRouter(routes, { initialUrl: "/register?token=invite-9" });
    expect(await screen.findByRole("header", { name: "Set your password" })).toBeTruthy();
    expect(router.getPathname()).toBe("/register");

    await fireEvent.changeText(screen.getByLabelText("Password"), "longenough!");
    await fireEvent.changeText(screen.getByLabelText("Confirm Password"), "longenough!");
    await fireEvent.press(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sllights.test/api/mobile/registeruser");
    expect(JSON.parse(init.body)).toEqual({ token: "invite-9", password: "longenough!" });
    // Signed in: the guard moves them into the app.
    expect(await screen.findByText("The app")).toBeTruthy();
  });

  it("lands straight on Reset your password with the link's token", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await renderRouter(routes, { initialUrl: "/reset-password?token=reset-1" });
    expect(await screen.findByRole("header", { name: "Reset your password" })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Password"), "longenough!");
    await fireEvent.changeText(screen.getByLabelText("Confirm Password"), "longenough!");
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://sllights.test/api/resetpassword");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "reset-1", newPassword: "longenough!" });
    expect(await screen.findByText("Password reset")).toBeTruthy();
  });

  it("still shows the welcome screen on a normal launch", async () => {
    await renderRouter(routes, { initialUrl: "/" });
    expect(await screen.findByLabelText("Streetleaf")).toBeTruthy();
    expect(screen.queryByText("Set your password")).toBeNull();
  });
});
