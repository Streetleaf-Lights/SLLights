import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { AppShell } from "@/components/AppShell";

describe("AppShell", () => {
  it("renders the Sidebar on ordinary app routes", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("hides the Sidebar on /signin", () => {
    usePathnameMock.mockReturnValue("/signin");
    render(
      <AppShell>
        <div>sign in content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByText("sign in content")).toBeInTheDocument();
  });

  it("hides the Sidebar on /register", () => {
    usePathnameMock.mockReturnValue("/register");
    render(
      <AppShell>
        <div>register content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByText("register content")).toBeInTheDocument();
  });

  it("hides the Sidebar on /forgot-password", () => {
    usePathnameMock.mockReturnValue("/forgot-password");
    render(
      <AppShell>
        <div>forgot password content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByText("forgot password content")).toBeInTheDocument();
  });

  it("hides the Sidebar on /reset-password", () => {
    usePathnameMock.mockReturnValue("/reset-password");
    render(
      <AppShell>
        <div>reset password content</div>
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByText("reset password content")).toBeInTheDocument();
  });

  it("still renders children even when the sidebar is hidden", () => {
    usePathnameMock.mockReturnValue("/signin");
    render(
      <AppShell>
        <div>hello</div>
      </AppShell>,
    );
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("does not show Sign Out in the Sidebar when isSignedIn is omitted", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("passes isSignedIn through to the Sidebar's Sign Out control", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(
      <AppShell isSignedIn>
        <div>page content</div>
      </AppShell>,
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("passes role through to the Sidebar, hiding Customers for a Customer Admin", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(
      <AppShell role="Customer Admin">
        <div>page content</div>
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Poles/ })).toBeInTheDocument();
  });

  it("passes customerId through to the Sidebar, hiding Customers and showing Projects for a Customer User", () => {
    usePathnameMock.mockReturnValue("/poles");
    render(
      <AppShell role="User" customerId="cust-1">
        <div>page content</div>
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projects/ })).toBeInTheDocument();
  });
});
