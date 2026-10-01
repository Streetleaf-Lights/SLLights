import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { UsersTable } from "@/components/UsersTable";
import type { User } from "@/lib/types";

function mockDeleteResponse(ok: boolean, body: unknown = { success: true }, status = ok ? 200 : 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockReinviteResponse(ok: boolean, body: unknown = { success: true }, status = ok ? 200 : 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockChangeRoleResponse(
  ok: boolean,
  body: unknown = { userId: "user-01", role: "Customer Admin", customerId: "cust-1" },
  status = ok ? 200 : 400,
) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

/** Opens the actions dropdown for the row containing rowText, returning that row element. */
async function openActionsMenu(
  user: ReturnType<typeof userEvent.setup>,
  rowText: string,
): Promise<HTMLElement> {
  const row = screen.getByText(rowText).closest("tr") as HTMLElement;
  await user.click(within(row).getByRole("button", { name: `Actions for ${rowText}` }));
  return row;
}

describe("UsersTable", () => {
  afterEach(() => {
    pushMock.mockClear();
    refreshMock.mockClear();
    vi.unstubAllGlobals();
  });

  const users: User[] = [
    {
      id: "user1",
      name: "Jane Doe",
      email: "jane@example.com",
      role: "Customer Admin",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    },
    {
      id: "user-04",
      name: "Colin Ashworth",
      email: "colin.ashworth@internal.co",
      role: "Viewer",
      status: "Inactive",
      customerId: "cust-004",
      customerName: "Summit Rural Electric",
    },
    {
      id: "user-pending",
      name: "Priya Nair",
      email: "priya@example.com",
      role: "Editor",
      status: "Pending",
      customerId: "cust-005",
      customerName: "Riverside Cooperative",
    },
  ];

  it("renders a row per user with name, email, role, and customer", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Customer Admin")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("hides the Customer column entirely when customerScoped is true", () => {
    render(<UsersTable users={users} customerScoped />);
    expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows the Customer column by default (customerScoped defaults to false)", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
  });

  it("shows 'Admin' instead of 'Customer Admin' in the Role column when customerScoped is true", () => {
    render(<UsersTable users={users} customerScoped />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("Customer Admin")).not.toBeInTheDocument();
  });

  it("shows 'Owner' instead of 'Customer Owner' in the Role column when customerScoped is true", () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    render(<UsersTable users={[owner]} customerScoped />);
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.queryByText("Customer Owner")).not.toBeInTheDocument();
  });

  it("shows the full 'Customer Owner', not abbreviated, when customerScoped is false", () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    render(<UsersTable users={[owner]} />);
    expect(screen.getByText("Customer Owner")).toBeInTheDocument();
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  });

  it("leaves other role values (e.g. Viewer) unchanged when customerScoped is true", () => {
    render(<UsersTable users={users} customerScoped />);
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });

  it("does not crash and falls back to Inactive when status is undefined (not just a string)", () => {
    const userWithMissingStatus = { ...users[0], status: undefined } as unknown as User;
    render(<UsersTable users={[userWithMissingStatus]} />);

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("does not render a Last Active column", () => {
    render(<UsersTable users={users} />);
    expect(screen.queryByRole("columnheader", { name: /last active/i })).not.toBeInTheDocument();
  });

  it("shows a Customer column instead", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
  });

  it("shows 'Streetleaf' as the customer when customerId is null", () => {
    const internalUser: User = {
      id: "user-internal",
      name: "Alex Rivera",
      email: "alex.rivera@streetleaf.com",
      role: "Streetleaf Admin",
      status: "Active",
      customerId: null,
      customerName: null,
    };
    render(<UsersTable users={[...users, internalUser]} />);

    const row = screen.getByText("Alex Rivera").closest("tr")!;
    expect(row).toHaveTextContent("Streetleaf");
  });

  it("shows the real customerName when customerId is present", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText("Streetleaf")).not.toBeInTheDocument();
  });

  it("shows Active/Inactive based on the status field", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows the role as plain text (not restricted to a fixed set)", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByText("Customer Admin")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });

  // --- Actions dropdown: trigger + menu contents ---------------------------

  it("renders an Actions trigger (•••) for each row that has an applicable action", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByRole("button", { name: "Actions for Jane Doe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Colin Ashworth" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Priya Nair" })).toBeInTheDocument();
  });

  it("shows nothing (not a dash) for a row with zero applicable actions (its own row, not pending)", () => {
    render(<UsersTable users={users} currentUserId="user1" />);

    const ownRow = screen.getByText("Jane Doe").closest("tr") as HTMLElement;
    expect(within(ownRow).queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    const cells = ownRow.querySelectorAll("td");
    expect(cells[cells.length - 1]).toHaveTextContent("");
  });

  it("opens a menu listing Delete for a row when its trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");

    expect(within(row).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("does not include Delete or Change Role in the menu for the current user's own row", async () => {
    const user = userEvent.setup();
    // Give the current user a pending status too, so their row still has a
    // trigger (Re-invite applies to yourself) — isolates that only
    // Delete/Change Role are the ones excluded for your own row.
    const withPendingSelf = [{ ...users[0], status: "Pending" }, ...users.slice(1)];
    render(<UsersTable users={withPendingSelf} currentUserId="user1" />);
    const row = await openActionsMenu(user, "Jane Doe");

    expect(within(row).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
    expect(within(row).getByRole("menuitem", { name: "Re-invite" })).toBeInTheDocument();
  });

  it("includes Delete and Change Role for every row when currentUserId doesn't match any of them", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} currentUserId="someone-else" />);
    for (const name of ["Jane Doe", "Colin Ashworth", "Priya Nair"]) {
      const row = await openActionsMenu(user, name);
      expect(within(row).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
      expect(within(row).getByRole("menuitem", { name: "Change Role" })).toBeInTheDocument();
    }
  });

  it("includes Re-invite in the menu only for a Pending user, not Active/Inactive ones", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);

    const pendingRow = await openActionsMenu(user, "Priya Nair");
    expect(within(pendingRow).getByRole("menuitem", { name: "Re-invite" })).toBeInTheDocument();

    const activeRow = await openActionsMenu(user, "Jane Doe");
    expect(within(activeRow).queryByRole("menuitem", { name: "Re-invite" })).not.toBeInTheDocument();
  });

  it("does not render an Actions column, trigger, or menu items when canManageUsers is false", () => {
    render(<UsersTable users={users} canManageUsers={false} />);
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it("shows the Actions column header by default", () => {
    render(<UsersTable users={users} />);
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("closes the currently open menu when a different row's trigger is clicked, keeping only one open at a time", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const janeRow = await openActionsMenu(user, "Jane Doe");
    expect(within(janeRow).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    const colinRow = await openActionsMenu(user, "Colin Ashworth");
    expect(within(colinRow).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(within(janeRow).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("opens the last row's menu upward instead of downward, so it isn't clipped by the table wrapper's overflow-hidden", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);

    // Jane Doe (not the last row) opens downward, as usual.
    const janeRow = await openActionsMenu(user, "Jane Doe");
    const janeMenu = within(janeRow).getByRole("menu");
    expect(janeMenu.className).toContain("mt-1");
    expect(janeMenu.className).not.toContain("bottom-full");

    // Priya Nair (the last row in this fixture) opens upward instead.
    const priyaRow = await openActionsMenu(user, "Priya Nair");
    const priyaMenu = within(priyaRow).getByRole("menu");
    expect(priyaMenu.className).toContain("bottom-full");
    expect(priyaMenu.className).not.toContain("mt-1");
  });

  it("closes the menu when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    await openActionsMenu(user, "Jane Doe");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument(),
    );
  });

  it("closes the menu when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    await openActionsMenu(user, "Jane Doe");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  // --- Re-invite -------------------------------------------------------------

  it("sends the pending user's id to /api/resendinvite and shows a success message on Re-invite", async () => {
    const fetchMock = mockReinviteResponse(true);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Priya Nair");
    await user.click(within(row).getByRole("menuitem", { name: "Re-invite" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resendinvite",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-pending" }),
      }),
    );
    expect(await screen.findByText("Invite sent.")).toBeInTheDocument();
  });

  it("closes the menu immediately when a menu item is clicked, before the request resolves", async () => {
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
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Priya Nair");
    await user.click(within(row).getByRole("menuitem", { name: "Re-invite" }));

    expect(screen.queryByRole("menuitem", { name: "Re-invite" })).not.toBeInTheDocument();

    resolveFetch({ ok: true, status: 200, json: () => Promise.resolve({ success: true }) });
    await screen.findByText("Invite sent.");
  });

  it("shows the server's error message when the resend fails", async () => {
    vi.stubGlobal(
      "fetch",
      mockReinviteResponse(false, { error: "user already registered" }, 409),
    );

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Priya Nair");
    await user.click(within(row).getByRole("menuitem", { name: "Re-invite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("user already registered");
  });

  it("shows a fallback error message when the resend request itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Priya Nair");
    await user.click(within(row).getByRole("menuitem", { name: "Re-invite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("redirects to /signin on a 401 from the resend request", async () => {
    vi.stubGlobal("fetch", mockReinviteResponse(false, { error: "session expired" }, 401));

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Priya Nair");
    await user.click(within(row).getByRole("menuitem", { name: "Re-invite" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
  });

  // --- Change Role -------------------------------------------------------------

  it("sends the target user's id to /api/changerole and shows the new role on success", async () => {
    const fetchMock = mockChangeRoleResponse(true, {
      userId: "user-04",
      role: "Admin",
      customerId: "cust-004",
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/changerole",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: "user-04" }),
      }),
    );
    expect(await screen.findByText("Role changed to Admin.")).toBeInTheDocument();
  });

  it("shows 'Role changed to Admin.' (not 'Customer Admin') when customerScoped, matching the Role column's own abbreviation", async () => {
    vi.stubGlobal(
      "fetch",
      mockChangeRoleResponse(true, {
        userId: "user-04",
        role: "Customer Admin",
        customerId: "cust-004",
      }),
    );

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} customerScoped />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    expect(await screen.findByText("Role changed to Admin.")).toBeInTheDocument();
    expect(screen.queryByText("Role changed to Customer Admin.")).not.toBeInTheDocument();
  });

  it("still shows the full 'Role changed to Customer Admin.' when not customerScoped", async () => {
    vi.stubGlobal(
      "fetch",
      mockChangeRoleResponse(true, {
        userId: "user-04",
        role: "Customer Admin",
        customerId: "cust-004",
      }),
    );

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    expect(await screen.findByText("Role changed to Customer Admin.")).toBeInTheDocument();
  });

  it("refreshes the page's server data after a successful role change, so the Role column updates", async () => {
    vi.stubGlobal("fetch", mockChangeRoleResponse(true));

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("shows the server's error message when the change-role request fails (e.g. a non-admin caller)", async () => {
    vi.stubGlobal(
      "fetch",
      mockChangeRoleResponse(
        false,
        { error: "this action requires one of: Streetleaf Admin, Customer Admin" },
        400,
      ),
    );

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "this action requires one of: Streetleaf Admin, Customer Admin",
    );
  });

  it("shows a fallback error message when the change-role request itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("redirects to /signin on a 401 from the change-role request", async () => {
    vi.stubGlobal("fetch", mockChangeRoleResponse(false, { error: "session expired" }, 401));

    const user = userEvent.setup();
    render(<UsersTable users={[users[1]]} />);
    const row = await openActionsMenu(user, "Colin Ashworth");
    await user.click(within(row).getByRole("menuitem", { name: "Change Role" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
  });

  // --- Customer Owner: excluded from Change Role / Delete -----------------

  it("excludes Change Role and Delete from the menu for a Customer Owner row, even when it isn't the viewer's own row", () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    render(<UsersTable users={[owner, ...users]} currentUserId="someone-else" />);

    const ownerRow = screen.getByText("Morgan Lee").closest("tr") as HTMLElement;
    // Not pending and no applicable action for anyone else — no trigger at all.
    expect(within(ownerRow).queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    const cells = ownerRow.querySelectorAll("td");
    expect(cells[cells.length - 1]).toHaveTextContent("");
  });

  it("still includes Re-invite for a pending Customer Owner row, alongside excluding Change Role/Delete", async () => {
    const pendingOwner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Pending",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[pendingOwner]} currentUserId="someone-else" />);
    const row = await openActionsMenu(user, "Morgan Lee");

    expect(within(row).getByRole("menuitem", { name: "Re-invite" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows Transfer Ownership (not Change Role) and Delete on a Customer Owner row, when the viewer is a Streetleaf Admin", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="someone-else" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");

    expect(within(row).getByRole("menuitem", { name: "Transfer Ownership" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
    expect(within(row).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("still excludes both Transfer Ownership and Delete for a Customer Owner row when the viewer is not a Streetleaf Admin (viewerIsStreetleafAdmin defaults to false)", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    render(<UsersTable users={[owner]} currentUserId="someone-else" />);

    const row = screen.getByText("Morgan Lee").closest("tr") as HTMLElement;
    expect(within(row).queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it("shows Transfer Ownership (but never Delete) on your own row when you are the Customer Owner", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="owner-1" />);
    const row = await openActionsMenu(user, "Morgan Lee");

    expect(within(row).getByRole("menuitem", { name: "Transfer Ownership" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
  });

  it("still never shows Delete on your own Customer-Owner row, even when viewerIsStreetleafAdmin is also set — self exclusion for Delete always applies first", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="owner-1" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");

    expect(within(row).getByRole("menuitem", { name: "Transfer Ownership" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("clicking Transfer Ownership on your own row opens the Invite modal locked to your own customer, with 'Customer Owner' preselected", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="owner-1" />);
    const row = await openActionsMenu(user, "Morgan Lee");
    await user.click(within(row).getByRole("menuitem", { name: "Transfer Ownership" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
    expect((within(dialog).getByLabelText("Role") as HTMLSelectElement).value).toBe(
      "Customer Owner",
    );
  });

  it("clicking Transfer Ownership opens the Invite modal locked to that row's customer, with 'Customer Owner' preselected", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="someone-else" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");
    await user.click(within(row).getByRole("menuitem", { name: "Transfer Ownership" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
    expect((within(dialog).getByLabelText("Role") as HTMLSelectElement).value).toBe(
      "Customer Owner",
    );
    // The warning shows too — this customer (cust1) already has an owner
    // (Morgan Lee, the very row Transfer Ownership was clicked from),
    // confirming customersWithOwner is correctly derived and passed
    // through, not just the role preselection.
    expect(within(dialog).getByText(/transfers ownership/i)).toBeInTheDocument();
  });

  it("closes the Transfer Ownership modal (and unmounts it) when Cancel is clicked", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="someone-else" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");
    await user.click(within(row).getByRole("menuitem", { name: "Transfer Ownership" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the success confirmation after a successful Transfer Ownership submit, and only unmounts the modal once it's acknowledged", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    vi.stubGlobal("fetch", mockReinviteResponse(true));

    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="someone-else" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");
    await user.click(within(row).getByRole("menuitem", { name: "Transfer Ownership" }));
    await user.type(screen.getByLabelText("Email"), "jordan@acme.example");
    await user.type(screen.getByLabelText("Name"), "Jordan Kim");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Invitation sent")).toBeInTheDocument();
    // Still mounted — the dialog is still up, just showing the confirmation.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closing the Transfer Ownership menu item still lets Delete on the same Owner row work normally, opening the usual confirmation modal", async () => {
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    };
    const fetchMock = mockDeleteResponse(true);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={[owner]} currentUserId="someone-else" viewerIsStreetleafAdmin />);
    const row = await openActionsMenu(user, "Morgan Lee");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ userId: "owner-1" });
  });

  // --- Delete + confirmation modal -----------------------------------------

  it("does not delete immediately — opens a confirmation modal instead", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the user being deleted in the confirmation modal", async () => {
    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Jane Doe");
  });

  it("closes the modal without deleting when Cancel is clicked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes the modal without deleting when the backdrop is clicked", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    const backdrop = screen.getByRole("dialog").parentElement!;
    await user.click(backdrop);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the user's id to /api/deleteuser when the delete is confirmed", async () => {
    const fetchMock = mockDeleteResponse(true);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/deleteuser");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ userId: "user1" });
  });

  it("closes the modal and refreshes the page's server data after a successful delete", async () => {
    vi.stubGlobal("fetch", mockDeleteResponse(true));

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows the server's error message and keeps the modal open on failure", async () => {
    vi.stubGlobal("fetch", mockDeleteResponse(false, { error: "cannot delete the last admin" }));

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("cannot delete the last admin");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("redirects to /signin (instead of showing an inline error) when the session actually expired (401)", async () => {
    vi.stubGlobal(
      "fetch",
      mockDeleteResponse(false, { error: "session expired, please sign in again" }, 401),
    );

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
    // No dead-end inline error — the person is just sent to sign back in.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a fallback error message when the delete request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup();
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables the confirm button and shows 'Deleting…' while the request is in flight", async () => {
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
    render(<UsersTable users={users} />);
    const row = await openActionsMenu(user, "Jane Doe");
    await user.click(within(row).getByRole("menuitem", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    const confirmButton = await screen.findByRole("button", { name: "Deleting…" });
    expect(confirmButton).toBeDisabled();

    resolveFetch({ ok: true, json: () => Promise.resolve({ success: true }) });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("renders no rows for an empty list", () => {
    render(<UsersTable users={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1); // header row only
  });

  it("paginates at 10 rows per page", async () => {
    const many: User[] = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: "Viewer",
      status: "Active",
      customerId: "cust1",
      customerName: "Acme Corp",
    }));
    const user = userEvent.setup();
    render(<UsersTable users={many} />);

    // 10 data rows + 1 header row
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("User 1")).toBeInTheDocument();
    expect(screen.queryByText("User 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("User 11")).toBeInTheDocument();
    expect(screen.queryByText("User 1")).not.toBeInTheDocument();
  });
});
