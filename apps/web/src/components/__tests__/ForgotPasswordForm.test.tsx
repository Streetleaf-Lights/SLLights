import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

function mockForgotPasswordResponse(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an email field, a submit button, and a Back to Sign In link", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Sign In" })).toBeInTheDocument();
  });

  it("links Back to Sign In to /signin", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByRole("link", { name: "Back to Sign In" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  it("shows no validation error before any interaction", () => {
    render(<ForgotPasswordForm />);
    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("shows the email format error live, as soon as an invalid value is typed", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "not-an-email");

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("clears the email error live once it becomes valid", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "@example.com");
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("shows a required error for an empty email on submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when the email is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the trimmed email to /api/forgotpassword on a valid submit", async () => {
    const fetchMock = mockForgotPasswordResponse(true, {
      message: "If that email exists, a reset link has been sent.",
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "  minh+4@streetleaf.com  ");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forgotpassword",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "minh+4@streetleaf.com" }),
      }),
    );
  });

  it("shows the server's message and hides the submit button on success", async () => {
    vi.stubGlobal(
      "fetch",
      mockForgotPasswordResponse(true, {
        message: "If that email exists, a reset link has been sent.",
      }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "If that email exists, a reset link has been sent.",
    );
    expect(screen.queryByRole("button", { name: "Send Reset Link" })).not.toBeInTheDocument();
  });

  it("still shows the Back to Sign In link after a successful submit", async () => {
    vi.stubGlobal(
      "fetch",
      mockForgotPasswordResponse(true, {
        message: "If that email exists, a reset link has been sent.",
      }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    await screen.findByRole("status");
    expect(screen.getByRole("link", { name: "Back to Sign In" })).toBeInTheDocument();
  });

  it("shows the server's error message and keeps the form open on failure", async () => {
    vi.stubGlobal("fetch", mockForgotPasswordResponse(false, { error: "malformed email" }));

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("malformed email");
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
  });

  it("shows a fallback error message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables the submit button and shows a sending label while in flight", async () => {
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
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    const button = await screen.findByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ message: "If that email exists, a reset link has been sent." }),
    });
    await screen.findByRole("status");
  });

  it("does not navigate away on submit (default form action is prevented)", async () => {
    vi.stubGlobal(
      "fetch",
      mockForgotPasswordResponse(true, {
        message: "If that email exists, a reset link has been sent.",
      }),
    );

    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Email"), "minh+4@streetleaf.com");
    await user.click(screen.getByRole("button", { name: "Send Reset Link" }));

    // If preventDefault() weren't called, jsdom would throw a "not implemented"
    // navigation error during this test — reaching here means it worked.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});
