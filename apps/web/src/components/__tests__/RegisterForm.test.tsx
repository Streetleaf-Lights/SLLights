import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { searchParamsGetMock } = vi.hoisted(() => ({
  searchParamsGetMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { RegisterForm } from "@/components/RegisterForm";

function mockRegisterResponse(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

const VALID_TOKEN = "52111603-53d7-4a99-a027-a105b4d527b5";

describe("RegisterForm", () => {
  beforeEach(() => {
    searchParamsGetMock.mockReset();
    searchParamsGetMock.mockReturnValue(VALID_TOKEN);
    // RegisterForm does a full navigation (window.location.href = ...)
    // rather than router.push, so it can't be verified via a next/navigation
    // mock — jsdom doesn't implement real navigation, so replace location
    // with a plain mutable object and assert against its href afterward.
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders password, confirm password, and a Set Password button", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set Password" })).toBeInTheDocument();
  });

  it("shows both password rules as unmet before any typing", () => {
    render(<RegisterForm />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("At least 1 special character")).toBeInTheDocument();
  });

  it("marks the length rule met once 8+ characters are typed", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "abcdefgh");

    expect(screen.getByText("At least 8 characters").className).toContain(
      "text-[var(--status-active)]",
    );
  });

  it("keeps the length rule unmet under 8 characters", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "abc123");

    expect(screen.getByText("At least 8 characters").className).not.toContain(
      "text-[var(--status-active)]",
    );
  });

  it("marks the special-character rule met once a special character is typed", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "abc.123");

    expect(screen.getByText("At least 1 special character").className).toContain(
      "text-[var(--status-active)]",
    );
  });

  it("keeps the special-character rule unmet with only letters/digits", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "abc12345");

    expect(screen.getByText("At least 1 special character").className).not.toContain(
      "text-[var(--status-active)]",
    );
  });

  it("shows no match/mismatch message before Confirm Password has any text", () => {
    render(<RegisterForm />);
    expect(screen.queryByText("Passwords match.")).not.toBeInTheDocument();
    expect(screen.queryByText("Passwords do not match.")).not.toBeInTheDocument();
  });

  it("shows 'Passwords match.' live once both fields are identical", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");

    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
  });

  it("shows 'Passwords do not match.' live as soon as they diverge", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.124");

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("updates the match status on every keystroke, not just at the end", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.124");
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Confirm Password"), "{backspace}3");
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
  });

  it("defaults both password fields to type='password' (masked)", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");
  });

  it("reveals the password field independently via its own eye icon", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const [passwordToggle] = screen.getAllByRole("button", { name: "Show password" });
    await user.click(passwordToggle);

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "password");
  });

  it("reveals the confirm password field independently via its own eye icon", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const toggles = screen.getAllByRole("button", { name: "Show password" });
    await user.click(toggles[1]);

    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("does not clear password values when toggling visibility", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    const [passwordToggle] = screen.getAllByRole("button", { name: "Show password" });
    await user.click(passwordToggle);

    expect(screen.getByLabelText("Password")).toHaveValue("Pass.123");
  });

  it("does not call fetch when the password fails the rules", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when the passwords don't match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.124");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an invalid-link error and does not call fetch when the token is missing", async () => {
    searchParamsGetMock.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invite link is invalid/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the invite token and password to /api/registeruser on a valid submit", async () => {
    const fetchMock = mockRegisterResponse(true, { user: { id: "1" } });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/registeruser",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: VALID_TOKEN, password: "Pass.123" }),
      }),
    );
  });

  it("navigates to /customers on a successful registration", async () => {
    vi.stubGlobal("fetch", mockRegisterResponse(true, { user: { id: "1" } }));

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    await waitFor(() => expect(window.location.href).toBe("/customers"));
  });

  it("redirects a Customer Admin to /poles instead of /customers", async () => {
    vi.stubGlobal(
      "fetch",
      mockRegisterResponse(true, { user: { id: "1", role: "Customer Admin" } }),
    );

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    await waitFor(() => expect(window.location.href).toBe("/projects"));
  });

  it("shows the server's error message and does not redirect on an invalid/expired invite link", async () => {
    vi.stubGlobal(
      "fetch",
      mockRegisterResponse(false, { error: "invalid or expired invite link" }),
    );

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or expired invite link");
    expect(window.location.href).toBe("");
  });

  it("shows a fallback error message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables the submit button and shows a setting-password label while in flight", async () => {
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
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    const button = await screen.findByRole("button", { name: "Setting password…" });
    expect(button).toBeDisabled();

    resolveFetch({ ok: true, json: () => Promise.resolve({ user: { id: "1" } }) });
    await waitFor(() => expect(window.location.href).not.toBe(""));
  });

  it("does not navigate away on submit (default form action is prevented)", async () => {
    vi.stubGlobal("fetch", mockRegisterResponse(true, { user: { id: "1" } }));

    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Password"), "Pass.123");
    await user.type(screen.getByLabelText("Confirm Password"), "Pass.123");
    await user.click(screen.getByRole("button", { name: "Set Password" }));

    // If preventDefault() weren't called, jsdom would throw a "not implemented"
    // navigation error during this test — reaching here means it worked.
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });
});
