import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { usePathnameMock, pushMock, refreshMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import Sidebar from "@/components/Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  it("renders all three nav items", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Poles/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/ })).toBeInTheDocument();
  });

  it("hides the Customers link for a Customer Admin", () => {
    usePathnameMock.mockReturnValue("/poles");
    render(<Sidebar role="Customer Admin" />);
    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Poles/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/ })).toBeInTheDocument();
  });

  it("shows the Customers link for a Streetleaf Admin", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar role="Streetleaf Admin" />);
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
  });

  it("shows the Customers link when no role is known (default)", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
  });

  it("shows the Projects link for a Customer Admin", () => {
    usePathnameMock.mockReturnValue("/projects");
    render(<Sidebar role="Customer Admin" />);
    expect(screen.getByRole("link", { name: /Projects/ })).toBeInTheDocument();
  });

  it("hides the Projects link for a Streetleaf Admin", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar role="Streetleaf Admin" />);
    expect(screen.queryByRole("link", { name: /Projects/ })).not.toBeInTheDocument();
  });

  it("hides the Projects link when no role is known (default)", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    expect(screen.queryByRole("link", { name: /Projects/ })).not.toBeInTheDocument();
  });

  it("hides Customers and shows Projects for a 'Customer User' (role User, with a customerId) — same as Customer Admin", () => {
    usePathnameMock.mockReturnValue("/poles");
    render(<Sidebar role="User" customerId="cust-1" />);
    expect(screen.queryByRole("link", { name: /Customers/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Projects/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Poles/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Users/ })).toBeInTheDocument();
  });

  it("shows Customers and hides Projects for a 'Streetleaf User' (role User, no customerId) — same as Streetleaf Admin", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar role="User" customerId={null} />);
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Projects/ })).not.toBeInTheDocument();
  });

  it("treats a plain User with no customerId prop passed at all the same as a Streetleaf User (customerId defaults to null)", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar role="User" />);
    expect(screen.getByRole("link", { name: /Customers/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Projects/ })).not.toBeInTheDocument();
  });

  it("places Projects above Poles for a Customer Admin", () => {
    usePathnameMock.mockReturnValue("/projects");
    render(<Sidebar role="Customer Admin" />);
    const projectsLink = screen.getByRole("link", { name: /Projects/ });
    const polesLink = screen.getByRole("link", { name: /Poles/ });
    expect(
      projectsLink.compareDocumentPosition(polesLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("links to the right hrefs", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: /Customers/ })).toHaveAttribute(
      "href",
      "/customers",
    );
    expect(screen.getByRole("link", { name: /Poles/ })).toHaveAttribute("href", "/poles");
    expect(screen.getByRole("link", { name: /Users/ })).toHaveAttribute("href", "/users");
  });

  it("treats nested customer detail routes as within the Customers section", () => {
    usePathnameMock.mockReturnValue("/customers/rec123/projects/p1");
    render(<Sidebar />);
    // The active item gets the accent-colored indicator bar; we assert via
    // the active text color class rather than reaching into internals.
    const customersLabel = screen.getByText("Customers");
    expect(customersLabel.className).toContain("text-[var(--sidebar-accent-ink)]");
  });

  it("does not mark Poles/Users active while on a Customers route", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    const polesLabel = screen.getByText("Poles");
    const usersLabel = screen.getByText("Users");
    expect(polesLabel.className).toContain("text-[var(--sidebar-accent-strong)]");
    expect(usersLabel.className).toContain("text-[var(--sidebar-accent-strong)]");
    // Neither should get the darker active-only ink color.
    expect(polesLabel.className).not.toContain("text-[var(--sidebar-accent-ink)]");
    expect(usersLabel.className).not.toContain("text-[var(--sidebar-accent-ink)]");
  });

  it("does not show Sign Out when the person isn't signed in", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("shows Sign Out below Users when the person is signed in", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar isSignedIn />);

    const usersLink = screen.getByRole("link", { name: /Users/ });
    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    // Sign Out follows Users in the nav's DOM order.
    expect(
      usersLink.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows Sign Out as '⇤ Sign Out', with the arrow and text sharing one color", () => {
    usePathnameMock.mockReturnValue("/customers");
    render(<Sidebar isSignedIn />);

    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    expect(signOutButton).toHaveTextContent("⇤ Sign Out");
    // A single span carries both the arrow and the text, so one class
    // controls both colors — no separate icon element to fall out of sync.
    expect(signOutButton.querySelectorAll("svg")).toHaveLength(0);
    const label = signOutButton.querySelector("span");
    expect(label?.className).toContain("text-[var(--sidebar-accent-strong)]");
  });

  it("posts to /api/signout when Sign Out is clicked", async () => {
    usePathnameMock.mockReturnValue("/customers");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<Sidebar isSignedIn />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/signout", { method: "POST" }));
    vi.unstubAllGlobals();
  });

  it("redirects to /signin and refreshes after a successful sign-out", async () => {
    usePathnameMock.mockReturnValue("/customers");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }),
    );

    const user = userEvent.setup();
    render(<Sidebar isSignedIn />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows an error and does not redirect when sign-out fails", async () => {
    usePathnameMock.mockReturnValue("/customers");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "session expired" }) }),
    );

    const user = userEvent.setup();
    render(<Sidebar isSignedIn />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("session expired");
    expect(pushMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows a fallback error message when the sign-out request itself fails", async () => {
    usePathnameMock.mockReturnValue("/customers");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<Sidebar isSignedIn />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    vi.unstubAllGlobals();
  });
});
