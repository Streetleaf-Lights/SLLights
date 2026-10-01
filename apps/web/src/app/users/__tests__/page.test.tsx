import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@/lib/types";

const { getUsersMock, getCustomersMock, getCustomerMock, getSessionUserMock, getSessionTokenMock } =
  vi.hoisted(() => ({
    getUsersMock: vi.fn(),
    getCustomersMock: vi.fn(),
    getCustomerMock: vi.fn(),
    getSessionUserMock: vi.fn(),
    getSessionTokenMock: vi.fn().mockResolvedValue("jwt-token"),
  }));

vi.mock("@/lib/apim", () => ({
  getUsers: getUsersMock,
  getCustomers: getCustomersMock,
  getCustomer: getCustomerMock,
}));

vi.mock("@/lib/session", () => ({
  getSessionUser: getSessionUserMock,
  getSessionToken: getSessionTokenMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import UsersPage from "@/app/users/page";

const users: User[] = [
  {
    id: "user1",
    name: "Jane Doe",
    email: "jane@example.com",
    role: "Customer Admin",
    status: "Active",
    customerId: "rec5uaHZMOGZGyVcY",
    customerName: "Coastal Power & Light",
  },
  {
    id: "user2",
    name: "Alex Rivera",
    email: "alex@streetleaf.com",
    role: "Streetleaf Admin",
    status: "Active",
    customerId: null,
    customerName: null,
  },
  {
    id: "user3",
    name: "Sam Lee",
    email: "sam@otherco.com",
    role: "Customer Admin",
    status: "Active",
    customerId: "rec-other-customer",
    customerName: "Other Co",
  },
  {
    id: "user4",
    name: "Pat Kim",
    email: "pat@example.com",
    role: "Customer Admin",
    status: "Active",
    customerId: "rec5uaHZMOGZGyVcY",
    customerName: "Coastal Power & Light",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    getUsersMock.mockReset();
    getCustomersMock.mockReset();
    getCustomerMock.mockReset();
    getCustomerMock.mockResolvedValue(undefined);
    getSessionUserMock.mockReset();
  });

  it("shows all users but hides the Invite User button when no session is present", async () => {
    getSessionUserMock.mockResolvedValue(null);
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite user" })).not.toBeInTheDocument();
  });

  it("shows no description text below the page title", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByText(/People with access/)).not.toBeInTheDocument();
  });

  it("shows all users and the Invite User button for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite user" })).toBeInTheDocument();
    expect(getCustomersMock).toHaveBeenCalledWith({ active: true }, "jwt-token");
  });

  it("scopes the user list to the Customer Admin's own customer", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
    expect(screen.queryByText("Sam Lee")).not.toBeInTheDocument();
  });

  it("hides the Customer column and shows 'Admin' (not 'Customer Admin') for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
    // Both Jane Doe and Pat Kim (same customer) are Customer Admins here.
    expect(screen.getAllByText("Admin")).toHaveLength(2);
    expect(screen.queryByText("Customer Admin")).not.toBeInTheDocument();
  });

  it("hides the Customer column and shows 'Admin' for a 'Customer User' too", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u6",
      role: "User",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Admin")).toHaveLength(2);
  });

  it("still shows the Customer column and full 'Customer Admin' label for a Streetleaf Admin (not customer-scoped)", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByRole("columnheader", { name: "Customer" })).toBeInTheDocument();
    // Jane Doe and Pat Kim, plus Sam Lee at a different customer.
    expect(screen.getAllByText("Customer Admin")).toHaveLength(3);
  });

  it("shows every user for a 'Streetleaf User' (role User, no customerId) — same full visibility as a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u5",
      role: "User",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Sam Lee")).toBeInTheDocument();
    expect(screen.getByText("Pat Kim")).toBeInTheDocument();
  });

  it("scopes the user list to their own customer for a 'Customer User' (role User, with a customerId) — same scoping as a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u6",
      role: "User",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Pat Kim")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
    expect(screen.queryByText("Sam Lee")).not.toBeInTheDocument();
  });

  it("still gives a 'Customer User' no management capability at all, despite seeing their customer's full list", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u6",
      role: "User",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite user" })).not.toBeInTheDocument();
  });

  it("shows the Invite User button for a Customer Admin, locked to their own customer", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);
    getCustomerMock.mockResolvedValue({
      id: "rec5uaHZMOGZGyVcY",
      name: "Coastal Power & Light",
      projects: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      createdAt: "2026-01-01",
    });

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByRole("button", { name: "Invite user" })).toBeInTheDocument();
    // Locked to their own customer — getCustomer (not getCustomers, the
    // full browsable list) is what supplies it.
    expect(getCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
    expect(getCustomersMock).not.toHaveBeenCalled();
  });

  it("shows the Actions column and a Delete button for other users' rows for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Actions for/ })[0]);
    expect(screen.getAllByRole("menuitem", { name: "Delete" }).length).toBeGreaterThan(0);
  });

  it("hides the Delete button on a Customer Admin's own row, but still shows it for other users at the same customer", async () => {
    getSessionUserMock.mockResolvedValue({
      // Matches Jane Doe (user1) — logged in as themselves.
      id: "user1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    // Jane Doe (self) and Pat Kim (other, same customer) are the only two
    // rows visible to this Customer Admin.
    const janeRow = screen.getByText("Jane Doe").closest("tr") as HTMLElement;
    const patRow = screen.getByText("Pat Kim").closest("tr") as HTMLElement;
    expect(within(janeRow).queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    await user.click(within(patRow).getByRole("button", { name: /Actions for/ }));
    expect(within(patRow).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows the Actions column and Delete button for other users' rows for a Streetleaf Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /Actions for/ })[0]);
    expect(screen.getAllByRole("menuitem", { name: "Delete" }).length).toBeGreaterThan(0);
  });

  it("hides the Delete button on a Streetleaf Admin's own row, but still shows it for everyone else", async () => {
    getSessionUserMock.mockResolvedValue({
      // Matches Alex Rivera (user2) — logged in as themselves.
      id: "user2",
      role: "Streetleaf Admin",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    const ownRow = screen.getByText("Alex Rivera").closest("tr") as HTMLElement;
    const otherRow = screen.getByText("Jane Doe").closest("tr") as HTMLElement;
    expect(within(ownRow).queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    await user.click(within(otherRow).getByRole("button", { name: /Actions for/ }));
    expect(within(otherRow).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("gives a Customer Owner full management capability, locked to their own customer — same as a Customer Admin, plus offering 'Customer Owner' in the Invite modal's role picker", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Owner",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);
    getCustomerMock.mockResolvedValue({
      id: "rec5uaHZMOGZGyVcY",
      name: "Coastal Power & Light",
      projects: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      active: true,
    });

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    // Customer-scoped: Customer column hidden, only sees rec5uaHZMOGZGyVcY's
    // own people (Jane Doe), not Alex Rivera (a different/no customer).
    expect(screen.queryByRole("columnheader", { name: "Customer" })).not.toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();

    // Locked to their own customer, same as a Customer Admin.
    expect(screen.getByRole("button", { name: "Invite user" })).toBeInTheDocument();
    expect(getCustomerMock).toHaveBeenCalledWith("rec5uaHZMOGZGyVcY", "jwt-token");
    expect(getCustomersMock).not.toHaveBeenCalled();

    // Can manage users — Actions column present.
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();

    // Offered "Customer Owner" as an invite role — the transfer mechanism.
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    const roleOptions = Array.from(
      (screen.getByLabelText("Role") as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(roleOptions).toContain("Customer Owner");
  });

  it("shows Transfer Ownership on a Customer Owner's own row when they're the one logged in", async () => {
    const ownSessionOwner: User = {
      id: "owner-self",
      name: "Morgan Lee",
      email: "morgan@coastal.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "rec5uaHZMOGZGyVcY",
      customerName: "Coastal Power & Light",
    };
    getSessionUserMock.mockResolvedValue({
      id: "owner-self",
      role: "Customer Owner",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue([...users, ownSessionOwner]);
    getCustomerMock.mockResolvedValue({
      id: "rec5uaHZMOGZGyVcY",
      name: "Coastal Power & Light",
      projects: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      active: true,
    });

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    const row = screen.getByText("Morgan Lee").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Actions for Morgan Lee" }));

    expect(within(row).getByRole("menuitem", { name: "Transfer Ownership" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("does not offer 'Customer Owner' in the Invite modal's role picker for a plain Customer Admin — only a Streetleaf Admin or the customer's own Owner can transfer ownership", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);
    getCustomerMock.mockResolvedValue({
      id: "rec5uaHZMOGZGyVcY",
      name: "Coastal Power & Light",
      projects: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      active: true,
    });

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    const roleOptions = Array.from(
      (screen.getByLabelText("Role") as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(roleOptions).not.toContain("Customer Owner");
  });

  it("gives a Streetleaf Admin viewer Transfer Ownership and Delete on a Customer Owner's row, end to end", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "rec5uaHZMOGZGyVcY",
      customerName: "Coastal Power & Light",
    };
    getUsersMock.mockResolvedValue([...users, owner]);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    const row = screen.getByText("Morgan Lee").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Actions for Morgan Lee" }));

    expect(within(row).getByRole("menuitem", { name: "Transfer Ownership" })).toBeInTheDocument();
    expect(within(row).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(within(row).queryByRole("menuitem", { name: "Change Role" })).not.toBeInTheDocument();
  });

  it("shows the ownership-transfer warning only for a customer that already has an owner, when a Streetleaf Admin searches and picks a customer in the Invite modal", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Streetleaf Admin",
      customerId: null,
    });
    const owner: User = {
      id: "owner-1",
      name: "Morgan Lee",
      email: "morgan@acme.example",
      role: "Customer Owner",
      status: "Active",
      customerId: "rec5uaHZMOGZGyVcY",
      customerName: "Coastal Power & Light",
    };
    getUsersMock.mockResolvedValue([...users, owner]);
    getCustomersMock.mockResolvedValue([
      { id: "rec5uaHZMOGZGyVcY", name: "Coastal Power & Light", active: true },
      { id: "rec-other-customer", name: "Otherco", active: true },
    ]);

    const jsx = await UsersPage();
    render(jsx);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.click(screen.getByLabelText("Customer Search"));
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");
    expect(screen.getByText(/transfers ownership/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.click(screen.getByLabelText("Customer Search"));
    await user.click(screen.getByRole("button", { name: "Otherco" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");
    expect(screen.queryByText(/transfers ownership/i)).not.toBeInTheDocument();
  });

  it("hides the Actions column entirely for a plain User role, even for other users' rows", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "user5",
      role: "User",
      customerId: null,
    });
    getUsersMock.mockResolvedValue(users);
    getCustomersMock.mockResolvedValue([]);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("skips getCustomers() entirely for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    await UsersPage();

    expect(getCustomersMock).not.toHaveBeenCalled();
  });

  it("shows the scoped result count for a Customer Admin", async () => {
    getSessionUserMock.mockResolvedValue({
      id: "u1",
      role: "Customer Admin",
      customerId: "rec5uaHZMOGZGyVcY",
    });
    getUsersMock.mockResolvedValue(users);

    const jsx = await UsersPage();
    render(jsx);

    expect(screen.getByText("2 users")).toBeInTheDocument();
  });
});
