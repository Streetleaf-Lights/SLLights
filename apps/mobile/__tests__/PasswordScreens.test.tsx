import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ForgotPasswordScreen from "../app/forgot-password";
import RegisterScreen from "../app/register";
import ResetPasswordScreen from "../app/reset-password";
import SignInScreen from "../app/sign-in";
import { ApiError } from "@/api/client";
import type { ReactNode } from "react";
import { IntroProvider } from "@/intro/IntroProvider";
import { fakeApi, withAuth as withAuthOnly } from "../test-utils/helpers";

/** The screens also use the welcome-screen state (an emailed link skips the welcome). */
const withAuth = (api: Parameters<typeof withAuthOnly>[0]) => {
  const Auth = withAuthOnly(api);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IntroProvider>
        <Auth>{children}</Auth>
      </IntroProvider>
    );
  };
};

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockParams = {};
});

const fillPasswords = async (password: string, confirmation: string) => {
  await fireEvent.changeText(screen.getByLabelText("Password"), password);
  await fireEvent.changeText(screen.getByLabelText("Confirm Password"), confirmation);
};

describe("Sign in", () => {
  it("links to Forgot password", async () => {
    await render(<SignInScreen />, { wrapper: withAuth(fakeApi()) });
    await fireEvent.press(screen.getByRole("link", { name: "Forgot your password?" }));
    expect(mockPush).toHaveBeenCalledWith("/forgot-password");
  });
});

describe("Forgot password", () => {
  it("sends the reset request and shows the server's generic message", async () => {
    const api = fakeApi();
    await render(<ForgotPasswordScreen />, { wrapper: withAuth(api) });
    expect(screen.getByRole("button", { name: "Send reset link" }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Email"), " nia@coastal.com ");
    await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText("If that email exists, a reset link has been sent.")).toBeTruthy();
    expect(api.forgotPassword).toHaveBeenCalledWith("nia@coastal.com");
    expect(screen.getByRole("button", { name: "Send reset link" }).props.accessibilityState.disabled).toBe(true); // once only
  });

  it("checks the email like the web form, and goes back to Sign In", async () => {
    await render(<ForgotPasswordScreen />, { wrapper: withAuth(fakeApi()) });
    await fireEvent.changeText(screen.getByLabelText("Email"), "nia@coastal");
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to Sign In" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});

describe("Reset your password", () => {
  it("shows the web's checklist and match status, and only enables Reset when both are met", async () => {
    mockParams = { token: "reset-1" };
    await render(<ResetPasswordScreen />, { wrapper: withAuth(fakeApi()) });
    const resetButton = () => screen.getByRole("button", { name: "Reset password" });
    await fillPasswords("short", "");
    expect(screen.getByLabelText("At least 8 characters: not yet met")).toBeTruthy();
    expect(screen.getByLabelText("At least 1 special character: not yet met")).toBeTruthy();
    await fillPasswords("longenough!", "longenough?");
    expect(screen.getByLabelText("At least 8 characters: met")).toBeTruthy();
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(resetButton().props.accessibilityState.disabled).toBe(true);
    await fillPasswords("longenough!", "longenough!");
    expect(screen.getByText("Passwords match.")).toBeTruthy();
    expect(resetButton().props.accessibilityState.disabled).toBe(false);
  });

  it("resets with the link's token, then offers Sign In", async () => {
    mockParams = { token: "reset-1" };
    const api = fakeApi();
    await render(<ResetPasswordScreen />, { wrapper: withAuth(api) });
    await fillPasswords("longenough!", "longenough!");
    await fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("Your password has been reset. You can now sign in with your new password.")).toBeTruthy();
    expect(api.resetPassword).toHaveBeenCalledWith("reset-1", "longenough!");
    await fireEvent.press(screen.getByRole("button", { name: "Back to Sign In" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("explains a link without a token", async () => {
    await render(<ResetPasswordScreen />, { wrapper: withAuth(fakeApi()) });
    expect(screen.getByText("This reset link is invalid or missing. Please request a new one.")).toBeTruthy();
    await fillPasswords("longenough!", "longenough!");
    expect(screen.getByRole("button", { name: "Reset password" }).props.accessibilityState.disabled).toBe(true);
  });

  it("shows an expired link's error from the server", async () => {
    mockParams = { token: "old" };
    await render(<ResetPasswordScreen />, {
      wrapper: withAuth(fakeApi({ resetPassword: jest.fn().mockRejectedValue(new ApiError("This reset link has expired.", 400)) })),
    });
    await fillPasswords("longenough!", "longenough!");
    await fireEvent.press(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("This reset link has expired.")).toBeTruthy();
  });

  it("shows and hides the password", async () => {
    mockParams = { token: "reset-1" };
    await render(<ResetPasswordScreen />, { wrapper: withAuth(fakeApi()) });
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  });
});

describe("Set your password (invite)", () => {
  it("completes the invite with the link's token", async () => {
    mockParams = { token: "invite-9" };
    const api = fakeApi({
      register: jest.fn().mockResolvedValue({
        token: "header.eyJzdWIiOiJ1MSIsInJvbGUiOiJVc2VyIn0.sig",
        user: { id: "u1", name: "N", email: "n@c.com", role: "User", customerId: null },
      }),
    });
    await render(<RegisterScreen />, { wrapper: withAuth(api) });
    await fillPasswords("longenough!", "longenough!");
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Set password" }));
    });
    await waitFor(() => expect(api.register).toHaveBeenCalledWith("invite-9", "longenough!"));
  });

  it("explains a link without a token", async () => {
    await render(<RegisterScreen />, { wrapper: withAuth(fakeApi()) });
    expect(screen.getByText("This invite link is invalid or missing. Please request a new one.")).toBeTruthy();
  });
});
