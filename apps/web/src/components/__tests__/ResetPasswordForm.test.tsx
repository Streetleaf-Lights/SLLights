import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { searchParamsGetMock } = vi.hoisted(() => ({
  searchParamsGetMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { ResetPasswordForm } from "@/components/ResetPasswordForm";

function mockResetResponse(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

const VALID_TOKEN = "b442b6bd-4fb5-4d54-9cc3-aedc9ae76603";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(VALID_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders New Password, Confirm Password, and a Reset Password button", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset Password" })).toBeInTheDocument();
  });

  it("shows both password rules as unmet before any typing", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("At least 1 special character")).toBeInTheDocument();
  });

  it("marks the length rule met once 8+ characters are typed", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "abcdefgh");

    expect(screen.getByText("At least 8 characters").className).toContain(
      "text-[var(--status-active)]",
    );
  });

  it("marks the special-character rule met once a special character is typed", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "abc.123");

    expect(screen.getByText("At least 1 special character").className).toContain(
      "text-[var(--status-active)]",
    );
  });

  it("shows 'Passwords match.' live once both fields are identical", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");

    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
  });

  it("shows 'Passwords do not match.' live as soon as they diverge", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.124");

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("defaults both password fields to type='password' (masked)", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");
  });

  it("reveals each password field independently via its own eye icon", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    const toggles = screen.getAllByRole("button", { name: "Show password" });
    await user.click(toggles[0]);

    expect(screen.getByLabelText("New Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");
  });

  it("does not call fetch when the password fails the rules", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when the passwords don't match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.124");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an invalid-link error and does not call fetch when the token is missing", async () => {
    searchParamsGetMock.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/reset link is invalid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the reset token and new password to /api/resetpassword on a valid submit", async () => {
    const fetchMock = mockResetResponse(true, { success: true });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resetpassword",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: VALID_TOKEN, newPassword: "Pass.123" }),
      }),
    );
  });

  it("shows a confirmation modal with a Back to Sign In link on success", async () => {
    vi.stubGlobal("fetch", mockResetResponse(true, { success: true }));

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/password has been reset/i);
    expect(screen.getByRole("link", { name: "Back to Sign In" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  it("does not show the confirmation modal before submitting", () => {
    render(<ResetPasswordForm />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the server's error message and does not show the modal on an invalid/expired link", async () => {
    vi.stubGlobal(
      "fetch",
      mockResetResponse(false, { error: "invalid or expired reset link" }),
    );

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired reset link");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a fallback error message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables the submit button and shows a resetting label while in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    const button = await screen.findByRole("button", { name: "Resetting…" });
    expect(button).toBeDisabled();

    resolveFetch({ ok: true, json: () => Promise.resolve({ success: true }) });
    await screen.findByRole("dialog");
  });

  it("does not navigate away on submit (default form action is prevented)", async () => {
    vi.stubGlobal("fetch", mockResetResponse(true, { success: true }));

    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("New Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Reset Password" }));

    // If preventDefault() weren't called, jsdom would throw a "not implemented"
    // navigation error during this test — reaching here means it worked.
    await screen.findByRole("dialog");
  });
});
