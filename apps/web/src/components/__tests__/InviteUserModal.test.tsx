import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { InviteUserModal } from "@/components/InviteUserModal";
import type { Customer } from "@/lib/types";

const customers: Customer[] = [
  {
    id: "cust-1",
    name: "Bayview Municipal Lighting",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  },
  {
    id: "cust-2",
    name: "Coastal Power & Light",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  },
  {
    id: "cust-3",
    name: "Highline Telecom Cooperative",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  },
  {
    // A real customer whose name happens to be exactly "Streetleaf" —
    // distinct from the internal/no-customer case, which this app also
    // labels "Streetleaf" in a couple of display-only spots (e.g.
    // UsersTable's customer column). Selecting this real customer should
    // behave identically to selecting any other one.
    id: "cust-streetleaf",
    name: "Streetleaf",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  },
];

type SetupUser = ReturnType<typeof userEvent.setup>;

async function openModal() {
  const user = userEvent.setup();
  render(<InviteUserModal customers={customers} />);
  await user.click(screen.getByRole("button", { name: "Invite user" }));
  return user;
}

/** Reveals the customer list by focusing the search box, without typing anything into it. */
async function focusCustomerSearch(user: SetupUser) {
  await user.click(screen.getByLabelText("Customer Search"));
}

function mockInviteResponse(ok: boolean, body: unknown, status = ok ? 200 : 400) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

const successBody = {
  userId: "8714b64b-1186-487a-820a-6ee0c53a2b25",
  email: "minh+9@streetleaf.com",
  emailSent: true,
};

describe("InviteUserModal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  it("does not show the modal until the trigger is clicked", () => {
    render(<InviteUserModal customers={customers} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels the customer search field 'Customer Search' (not just 'Customer')", async () => {
    await openModal();
    expect(screen.getByText("Customer Search")).toBeInTheDocument();
    expect(screen.queryByText("Customer", { selector: "label" })).not.toBeInTheDocument();
  });

  it("opens the modal with the customer search left blank", async () => {
    await openModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Customer Search")).toHaveValue("");
  });

  it("focuses the email input (not the customer search) as soon as the modal opens", async () => {
    await openModal();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Customer Search")).not.toHaveFocus();
  });

  it("does not show the customer list until the search box is focused", async () => {
    await openModal();
    expect(
      screen.queryByRole("button", { name: "Bayview Municipal Lighting" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Coastal Power & Light" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Highline Telecom Cooperative" }),
    ).not.toBeInTheDocument();
  });

  it("shows all customers once the search box is focused (empty search)", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);

    expect(screen.getByRole("button", { name: "Bayview Municipal Lighting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coastal Power & Light" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Highline Telecom Cooperative" }),
    ).toBeInTheDocument();
  });

  it("selects the existing text in the customer search box when refocused", async () => {
    const user = await openModal();
    const input = screen.getByLabelText("Customer Search") as HTMLInputElement;
    await user.type(input, "Coastal");
    await user.click(screen.getByLabelText("Email"));
    await user.click(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Coastal".length);
  });

  it("selects the existing text in the customer search box when refocused via Change", async () => {
    const user = await openModal();
    const input = screen.getByLabelText("Customer Search") as HTMLInputElement;
    await user.type(input, "Coastal");
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Coastal".length);
  });

  it("shows all customers again when the search is cleared", async () => {
    const user = await openModal();
    await user.type(screen.getByLabelText("Customer Search"), "Coastal");
    expect(
      screen.queryByRole("button", { name: "Bayview Municipal Lighting" }),
    ).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Customer Search"));

    expect(screen.getByRole("button", { name: "Bayview Municipal Lighting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coastal Power & Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highline Telecom Cooperative" })).toBeInTheDocument();
  });

  it("shows the selected customer's name with a 'Selected' label below the Customer Search label, with no box around it", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    expect(screen.getByText("Selected:")).toBeInTheDocument();
    const selectedName = screen.getByText("Bayview Municipal Lighting", { selector: "span" });
    const searchLabel = screen.getByText("Customer Search");
    // The "Customer Search" label appears before the selected-customer row in the DOM (above it).
    expect(
      searchLabel.compareDocumentPosition(selectedName) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No box: the containing row shouldn't carry border/background styling.
    const row = screen.getByText("Selected:").parentElement;
    expect(row?.className).not.toContain("border");
    expect(row?.className).not.toContain("bg-[");
  });

  it("colors the selected customer's name teal", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    const selectedName = screen.getByText("Bayview Municipal Lighting", { selector: "span" });
    expect(selectedName.className).toContain("text-[var(--accent)]");
  });

  it("lays out the Selected row with label+name on the left and Change on the right", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    const row = screen.getByText("Selected:").parentElement!;
    expect(row.className).toContain("justify-between");
    const changeButton = screen.getByRole("button", { name: "Change" });
    // "Selected: ..." precedes "Change" in the DOM within that flex row.
    expect(
      screen.getByText("Selected:").compareDocumentPosition(changeButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("hides the customer list once a customer is selected", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    expect(screen.getByRole("button", { name: "Coastal Power & Light" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));

    expect(screen.queryByRole("button", { name: "Bayview Municipal Lighting" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Highline Telecom Cooperative" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the search box visible after a selection is made", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    expect(screen.getByLabelText("Customer Search")).toBeInTheDocument();
  });

  it("shows the customer list again when clicking directly into the search box, without needing Change", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));
    expect(screen.queryByRole("button", { name: "Bayview Municipal Lighting" })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Customer Search"));

    expect(screen.getByRole("button", { name: "Bayview Municipal Lighting" })).toBeInTheDocument();
    // The selection itself is untouched by just reopening the list.
    expect(screen.getByText("Selected:")).toBeInTheDocument();
  });

  it("hides the list again immediately once a new customer is picked from it", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));
    await user.click(screen.getByLabelText("Customer Search"));
    await user.clear(screen.getByLabelText("Customer Search"));
    expect(screen.getByRole("button", { name: "Coastal Power & Light" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));

    expect(screen.queryByRole("button", { name: "Bayview Municipal Lighting" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Highline Telecom Cooperative" }),
    ).not.toBeInTheDocument();
  });

  it("shows the customer list again after clicking Change", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));
    expect(screen.queryByRole("button", { name: "Bayview Municipal Lighting" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(screen.getByRole("button", { name: "Bayview Municipal Lighting" })).toBeInTheDocument();
    expect(screen.queryByText("Selected:")).not.toBeInTheDocument();
  });

  it("refocuses the search box after clicking Change", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(screen.getByLabelText("Customer Search")).toHaveFocus();
  });

  it("defaults the role to 'Streetleaf Admin' when no customer is selected", async () => {
    await openModal();

    expect(screen.getByLabelText("Role")).toHaveValue("Streetleaf Admin");
  });

  it("sets the role to 'Customer Admin' once any customer is selected", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));

    expect(screen.getByLabelText("Role")).toHaveValue("Customer Admin");
  });

  it("reverts the role back to 'Streetleaf Admin' after Change clears the selection", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    expect(screen.getByLabelText("Role")).toHaveValue("Customer Admin");

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(screen.getByLabelText("Role")).toHaveValue("Streetleaf Admin");
  });

  it("deselects the customer and reverts the role to 'Streetleaf Admin' when the search box is cleared", async () => {
    const user = await openModal();
    const input = screen.getByLabelText("Customer Search") as HTMLInputElement;
    await user.type(input, "Coastal");
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    expect(screen.getByLabelText("Role")).toHaveValue("Customer Admin");

    await user.clear(input);

    expect(screen.getByLabelText("Role")).toHaveValue("Streetleaf Admin");
    expect(screen.queryByText("Selected:")).not.toBeInTheDocument();
  });

  it("makes the Role field an interactive dropdown (not disabled)", async () => {
    await openModal();
    expect(screen.getByLabelText("Role")).not.toBeDisabled();
    expect(screen.getByLabelText("Role").tagName).toBe("SELECT");
  });

  it("offers Streetleaf Admin and User when no customer is selected", async () => {
    await openModal();
    const dropdown = screen.getByLabelText("Role") as HTMLSelectElement;
    const optionLabels = Array.from(dropdown.querySelectorAll("option")).map(
      (opt) => opt.textContent,
    );
    expect(optionLabels).toEqual(["Streetleaf Admin", "User"]);
  });

  it("offers Customer Admin and User once a customer is selected", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));

    const dropdown = screen.getByLabelText("Role") as HTMLSelectElement;
    const optionLabels = Array.from(dropdown.querySelectorAll("option")).map(
      (opt) => opt.textContent,
    );
    expect(optionLabels).toEqual(["Customer Admin", "User"]);
  });

  it("lets the person pick User when no customer is selected, and includes it in the submitted role", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await user.selectOptions(screen.getByLabelText("Role"), "User");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ role: "User" });
  });

  it("lets the person pick User even when a customer is selected, and includes it (plus the customerId) in the submitted role", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    await user.selectOptions(screen.getByLabelText("Role"), "User");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ role: "User", customerId: "cust-2" });
  });

  it("resets a 'User' choice back to the context default when the customer selection changes", async () => {
    const user = await openModal();
    await user.selectOptions(screen.getByLabelText("Role"), "User");
    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("User");

    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));

    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("Customer Admin");
  });

  it("shows no email/name errors before attempting to submit", async () => {
    await openModal();
    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();
  });

  it("shows the email format error live, as soon as an invalid value is typed — no Submit needed", async () => {
    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "not-an-email");

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("clears the email error live as soon as it becomes valid — no Submit needed", async () => {
    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "@example.com");
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("shows the name-required error live once the field is typed into and cleared — no Submit needed", async () => {
    const user = await openModal();
    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "a");
    expect(screen.queryByText("Name is required.")).not.toBeInTheDocument();

    await user.clear(nameInput);
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
  });

  it("shows required errors for empty email and name on submit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an invalid-format error for a malformed email on submit", async () => {
    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("clears the email error once a valid email is entered", async () => {
    const user = await openModal();
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("posts trimmed name/email, the derived role, and no customerId for a Streetleaf Admin invite", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "  jane@example.com  ");
    await user.type(screen.getByLabelText("Name"), "  Jane Doe  ");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/inviteuser");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ name: "Jane Doe", email: "jane@example.com", role: "Streetleaf Admin" });
    expect(body.customerId).toBeUndefined();
  });

  it("includes the selected customer's id and 'Customer Admin' role when a customer is selected", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Coastal Power & Light" }));
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      role: "Customer Admin",
      customerId: "cust-2",
    });
  });

  it("selecting a customer named exactly 'Streetleaf' is treated the same as no customer selected — shows 'Streetleaf Admin', not 'Customer Admin', and omits customerId, not that customer's real id", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Streetleaf" }));

    // Intentional special case: a customer literally named "Streetleaf"
    // is treated as the internal/top-level case, not a real customer.
    expect(screen.getByLabelText("Role")).toHaveValue("Streetleaf Admin");

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ name: "Jane Doe", email: "jane@example.com", role: "Streetleaf Admin" });
    expect(body.customerId).toBeUndefined();
  });

  it("still shows 'Selected: Streetleaf' and allows Change after picking the Streetleaf-named customer, even though it's treated as no customer for role/submission purposes", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Streetleaf" }));

    expect(screen.getByText("Selected:")).toBeInTheDocument();
    expect(screen.getByText("Streetleaf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("does not apply the Streetleaf special case to a locked customer (a genuine Customer Admin's own customer) named 'Streetleaf' — that would let them grant Streetleaf Admin access", async () => {
    const streetleafLockedCustomer: Customer = {
      id: "cust-locked-streetleaf",
      name: "Streetleaf",
      projects: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      active: true,
    };
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InviteUserModal customers={customers} lockedCustomer={streetleafLockedCustomer} />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    expect(screen.getByLabelText("Role")).toHaveValue("Customer Admin");

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      name: "Jane Doe",
      email: "jane@example.com",
      role: "Customer Admin",
      customerId: "cust-locked-streetleaf",
    });
  });

  it("still applies the Streetleaf special case when the stored name has a trailing space (regression: the real customer record is \"Streetleaf \", which a bare === would never match)", async () => {
    const paddedCustomers: Customer[] = [
      // Excludes the base fixture's exact "Streetleaf" customer — testing-
      // library normalizes whitespace when computing accessible names, so
      // "Streetleaf" and "Streetleaf " would resolve to the same name and
      // collide if both were in the list at once.
      ...customers.filter((c) => c.name !== "Streetleaf"),
      {
        id: "cust-streetleaf-padded",
        name: "Streetleaf ",
        projects: [],
        address: null,
        city: null,
        state: null,
        zip: null,
        phone: null,
        active: true,
      },
    ];
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InviteUserModal customers={paddedCustomers} />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Streetleaf" }));

    expect(screen.getByLabelText("Role")).toHaveValue("Streetleaf Admin");

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({ name: "Jane Doe", email: "jane@example.com", role: "Streetleaf Admin" });
    expect(body.customerId).toBeUndefined();
  });

  it("closes the modal on a successful submit", async () => {
    vi.stubGlobal("fetch", mockInviteResponse(true, successBody));

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("refreshes the page's server data after a successful submit, so the new user shows up", async () => {
    vi.stubGlobal("fetch", mockInviteResponse(true, successBody));

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("does not refresh the page's server data when the submit fails", async () => {
    vi.stubGlobal("fetch", mockInviteResponse(false, { error: "email already invited" }));

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByRole("alert");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the server's error message and does not close the modal on failure", async () => {
    vi.stubGlobal("fetch", mockInviteResponse(false, { error: "email already invited" }));

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("email already invited");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("redirects to /signin (instead of showing an inline error) when the session actually expired (401)", async () => {
    vi.stubGlobal(
      "fetch",
      mockInviteResponse(false, { error: "session expired, please sign in again" }, 401),
    );

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/signin"));
    expect(refreshMock).toHaveBeenCalled();
    // No dead-end inline error, and the modal closes — the person is just
    // sent to sign back in.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a fallback error message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("disables Submit and shows a 'Sending…' label while the request is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const button = await screen.findByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();

    resolveFetch({ ok: true, json: () => Promise.resolve(successBody) });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes the modal and resets state when Cancel is clicked", async () => {
    const user = await openModal();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Customer Search")).toHaveValue("");
    // The stale "touched" state from before Cancel shouldn't carry over.
    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
    expect(screen.queryByText("Email is required.")).not.toBeInTheDocument();
  });

  it("closes the modal when clicking the backdrop", async () => {
    const user = await openModal();
    // The backdrop is the dialog's parent overlay element.
    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("InviteUserModal with a lockedCustomer (Customer Admin inviting into their own customer)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  const lockedCustomer: Customer = {
    id: "cust-2",
    name: "Coastal Power & Light",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  };

  async function openLockedModal() {
    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    return user;
  }

  it("shows the locked customer's name as a plain read-only label, with no Customer Search field", async () => {
    await openLockedModal();

    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
    expect(screen.queryByLabelText("Customer Search")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
  });

  it("defaults the Role dropdown to Customer Admin (not Streetleaf Admin) when locked", async () => {
    await openLockedModal();

    const dropdown = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(dropdown.value).toBe("Customer Admin");
    const optionLabels = Array.from(dropdown.querySelectorAll("option")).map(
      (opt) => opt.textContent,
    );
    expect(optionLabels).toEqual(["Customer Admin", "User"]);
  });

  it("submits with the locked customer's id, even though there was never a search step", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openLockedModal();
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      role: "Customer Admin",
      customerId: "cust-2",
    });
  });

  it("still allows picking User instead, keeping the locked customerId", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = await openLockedModal();
    await user.selectOptions(screen.getByLabelText("Role"), "User");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ role: "User", customerId: "cust-2" });
  });

  it("resets back to the locked customer/Customer Admin default (not Streetleaf Admin) after Cancel and reopening", async () => {
    const user = await openLockedModal();
    await user.selectOptions(screen.getByLabelText("Role"), "User");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Invite user" }));
    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("Customer Admin");
  });
});

describe("InviteUserModal — Customer Owner role option (canInviteOwner)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  const lockedCustomer: Customer = {
    id: "cust-2",
    name: "Coastal Power & Light",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  };

  function roleOptionValues(): string[] {
    return Array.from((screen.getByLabelText("Role") as HTMLSelectElement).options).map(
      (o) => o.value,
    );
  }

  it("does not offer 'Customer Owner' by default (canInviteOwner false/omitted), even once a customer is selected via search", async () => {
    const user = await openModal();
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    expect(roleOptionValues()).not.toContain("Customer Owner");
  });

  it("offers 'Customer Owner' once a customer is selected via search, when canInviteOwner is true (a Streetleaf Admin)", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={customers} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    expect(roleOptionValues()).toContain("Customer Owner");
  });

  it("does not offer 'Customer Owner' before any customer is selected, even when canInviteOwner is true — no customer context yet", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={customers} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    expect(roleOptionValues()).not.toContain("Customer Owner");
  });

  it("offers 'Customer Owner' immediately when locked to a customer and canInviteOwner is true (the customer's own current Owner, transferring ownership)", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    expect(roleOptionValues()).toContain("Customer Owner");
  });

  it("does not offer 'Customer Owner' when locked to a customer but canInviteOwner is false (a plain Customer Admin)", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    expect(roleOptionValues()).not.toContain("Customer Owner");
  });

  it("shows a warning that ownership will transfer when 'Customer Owner' is selected, for a customer that already has one", async () => {
    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        canInviteOwner
        customersWithOwner={["cust-2"]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");

    expect(
      screen.getByText(/transfers ownership.*current Customer Owner is removed/i),
    ).toBeInTheDocument();
  });

  it("does not show the warning at all when the customer has no existing Customer Owner yet — a first assignment isn't a transfer", async () => {
    const user = userEvent.setup();
    render(
      <InviteUserModal customers={[]} lockedCustomer={lockedCustomer} canInviteOwner />,
    );
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");

    expect(screen.queryByText(/transfers ownership/i)).not.toBeInTheDocument();
  });

  it("does not show the ownership-transfer warning for other role choices", async () => {
    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        canInviteOwner
        customersWithOwner={["cust-2"]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    expect(screen.queryByText(/transfers ownership/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");
    expect(screen.getByText(/transfers ownership/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Role"), "User");
    expect(screen.queryByText(/transfers ownership/i)).not.toBeInTheDocument();
  });

  it("resets away from Customer Owner (and hides the warning) when the customer selection changes via search", async () => {
    const user = userEvent.setup();
    render(
      <InviteUserModal customers={customers} canInviteOwner customersWithOwner={["cust-1"]} />,
    );
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");
    expect(screen.getByText(/transfers ownership/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("Streetleaf Admin");
    expect(screen.queryByText(/transfers ownership/i)).not.toBeInTheDocument();
    expect(roleOptionValues()).not.toContain("Customer Owner");
  });

  it("submits with role: 'Customer Owner' and the selected customer's id", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await user.selectOptions(screen.getByLabelText("Role"), "Customer Owner");
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      role: "Customer Owner",
      customerId: "cust-2",
    });
  });

  it("lists 'Customer Owner' as the first option when offered, even though the selected/default value is still Customer Admin", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    const select = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "Customer Owner",
      "Customer Admin",
      "User",
    ]);
    expect(select.value).toBe("Customer Admin");
  });

  it("lists 'Customer Owner' first for a Streetleaf Admin browsing via Customer Search too, once a customer is picked", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={customers} canInviteOwner />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));
    await focusCustomerSearch(user);
    await user.click(screen.getByRole("button", { name: "Bayview Municipal Lighting" }));

    const select = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "Customer Owner",
      "Customer Admin",
      "User",
    ]);
    expect(select.value).toBe("Customer Admin");
  });

  it("does not reorder anything when Customer Owner isn't offered — Customer Admin/Streetleaf Admin stays first, as the only non-User option", async () => {
    const user = userEvent.setup();
    render(<InviteUserModal customers={[]} lockedCustomer={lockedCustomer} />);
    await user.click(screen.getByRole("button", { name: "Invite user" }));

    const select = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["Customer Admin", "User"]);
  });
});

describe("InviteUserModal — external control (autoOpen/hideTrigger/initialRole/onClose)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    refreshMock.mockClear();
  });

  const lockedCustomer: Customer = {
    id: "cust-2",
    name: "Coastal Power & Light",
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
  };

  it("opens immediately (no button click needed) when autoOpen is set", () => {
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render the built-in 'Invite user' button when hideTrigger is set", () => {
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
      />,
    );

    expect(screen.queryByRole("button", { name: "Invite user" })).not.toBeInTheDocument();
  });

  it("preselects initialRole instead of the usual lockedCustomer-based default", () => {
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        customersWithOwner={["cust-2"]}
        initialRole="Customer Owner"
      />,
    );

    expect((screen.getByLabelText("Role") as HTMLSelectElement).value).toBe("Customer Owner");
    // The transfer warning shows immediately too, since it's already selected
    // — matching the real Transfer Ownership usage, where the target
    // customer always already has the owner being replaced.
    expect(screen.getByText(/transfers ownership/i)).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
        onClose={onClose}
      />,
    );

    const backdrop = screen.getByRole("dialog").parentElement!;
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a success confirmation instead of closing immediately after a successful Customer Owner submit — onClose isn't called yet", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
        onClose={onClose}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Invitation sent")).toBeInTheDocument();
    expect(screen.getByText(/morgan lee/i)).toBeInTheDocument();
    expect(screen.getByText(/coastal power & light/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose (and closes the whole modal) only once the success confirmation is acknowledged", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
        onClose={onClose}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText("Invitation sent");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refreshes the page's server data as soon as the invite succeeds, without waiting for the success message to be acknowledged", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
      />,
    );
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByText("Invitation sent");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not show the success confirmation for a normal (non-Customer-Owner) invite — it still just closes immediately", async () => {
    const fetchMock = mockInviteResponse(true, successBody);
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        onClose={onClose}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Invitation sent")).not.toBeInTheDocument();
  });

  it("does not call onClose on a failed submit — the modal stays open to show the error", async () => {
    vi.stubGlobal("fetch", mockInviteResponse(false, { error: "email already invited" }, 409));
    const onClose = vi.fn();

    const user = userEvent.setup();
    render(
      <InviteUserModal
        customers={[]}
        lockedCustomer={lockedCustomer}
        autoOpen
        hideTrigger
        canInviteOwner
        initialRole="Customer Owner"
        onClose={onClose}
      />,
    );
    await user.type(screen.getByLabelText("Email"), "morgan@coastal.example");
    await user.type(screen.getByLabelText("Name"), "Morgan Lee");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await screen.findByRole("alert");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
