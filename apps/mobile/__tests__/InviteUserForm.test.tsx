import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { InviteUserForm } from "@/users/InviteUserForm";
import { UsersListView } from "@/users/UsersListView";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "me", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "me", name: "Me", email: "me@x.com", role, customerId } });
}

beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const customers = [
  { id: "c1", name: "Coastal Power" },
  { id: "c2", name: "Harbor City" },
  { id: "sl", name: "Streetleaf " },
];

async function renderForm(overrides: Record<string, jest.Mock> = {}, owners: string[] = []) {
  const api = fakeApi({
    getMyCustomer: jest.fn().mockResolvedValue({ customer: { id: "c1", name: "Coastal Power" } }),
    listCustomers: jest.fn().mockResolvedValue({ customers }),
    ...overrides,
  });
  const onSent = jest.fn();
  const onCancel = jest.fn();
  await render(<InviteUserForm customersWithOwner={new Set(owners)} onSent={onSent} onCancel={onCancel} />, {
    wrapper: withSignedInAuth(api),
  });
  await screen.findByText("Invite user");
  return { api, onSent, onCancel };
}

const roleNames = () => screen.getAllByRole("radio").map((r) => r.props.accessibilityLabel);
const selectedRole = () => screen.getAllByRole("radio").find((r) => r.props.accessibilityState.selected)?.props.accessibilityLabel;
const fill = async (email: string, name: string) => {
  await fireEvent.changeText(screen.getByLabelText("Email"), email);
  await fireEvent.changeText(screen.getByLabelText("Name"), name);
};
const send = () => fireEvent.press(screen.getByRole("button", { name: "Send invite" }));

describe("InviteUserForm", () => {
  it("locks a Customer Admin to their own customer, with Customer Admin (default) and User", async () => {
    await signIn("Customer Admin", "c1");
    const { api, onSent } = await renderForm();
    expect(await screen.findByText("Coastal Power")).toBeTruthy();
    expect(screen.queryByLabelText("Search customers…")).toBeNull();
    expect(roleNames()).toEqual(["Customer Admin", "User"]);
    expect(selectedRole()).toBe("Customer Admin");

    await fill(" nia@coastal.com ", " Nia ");
    await send();
    await waitFor(() =>
      expect(api.inviteUser).toHaveBeenCalledWith({ name: "Nia", email: "nia@coastal.com", role: "Customer Admin" }),
    );
    expect(onSent).toHaveBeenCalledWith("Invitation sent to nia@coastal.com.");
  });

  it("lets a Customer Owner invite a new Owner, with the transfer warning and message", async () => {
    await signIn("Customer Owner", "c1");
    const { onSent } = await renderForm({}, ["c1"]);
    expect(roleNames()).toEqual(["Customer Admin", "User", "Customer Owner"]);
    await fireEvent.press(screen.getByRole("radio", { name: "Customer Owner" }));
    expect(screen.getByText(/This transfers ownership/)).toBeTruthy();
    await fill("nia@coastal.com", "Nia");
    await send();
    await waitFor(() =>
      expect(onSent).toHaveBeenCalledWith(
        "Invitation sent. Nia was invited to become the new Customer Owner for Coastal Power. Once they accept, the current owner will be removed.",
      ),
    );
  });

  it("gives a Streetleaf Admin Customer Search; with no customer it's a Streetleaf invite", async () => {
    await signIn("Streetleaf Admin", null);
    const { api } = await renderForm();
    expect(await screen.findByText("Leave empty to invite Streetleaf staff.")).toBeTruthy();
    expect(roleNames()).toEqual(["Streetleaf Admin", "User"]);
    await fill("sam@streetleaf.com", "Sam");
    await send();
    await waitFor(() =>
      expect(api.inviteUser).toHaveBeenCalledWith({ name: "Sam", email: "sam@streetleaf.com", role: "Streetleaf Admin" }),
    );
  });

  it("switches to customer roles when a customer is picked, resets the role when it changes, and sends that customer", async () => {
    await signIn("Streetleaf Admin", null);
    const { api } = await renderForm();
    await fireEvent.changeText(await screen.findByLabelText("Search customers…"), "har");
    await fireEvent.press(screen.getByRole("button", { name: "Select Harbor City" }));
    expect(screen.getByText("Selected: Harbor City")).toBeTruthy();
    expect(roleNames()).toEqual(["Customer Admin", "User", "Customer Owner"]);
    await fireEvent.press(screen.getByRole("radio", { name: "User" }));

    await fireEvent.press(screen.getByRole("button", { name: "Change customer" }));
    expect(roleNames()).toEqual(["Streetleaf Admin", "User"]);
    expect(selectedRole()).toBe("Streetleaf Admin"); // reset, not kept as "User"

    await fireEvent.changeText(screen.getByLabelText("Search customers…"), "coast");
    await fireEvent.press(screen.getByRole("button", { name: "Select Coastal Power" }));
    expect(selectedRole()).toBe("Customer Admin");
    await fill("nia@coastal.com", "Nia");
    await send();
    await waitFor(() => expect(api.inviteUser).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer Admin", customerId: "c1" })));
  });

  it("treats the 'Streetleaf' customer record as a Streetleaf invite", async () => {
    await signIn("Streetleaf Admin", null);
    const { api } = await renderForm();
    await fireEvent.changeText(await screen.findByLabelText("Search customers…"), "street");
    await fireEvent.press(screen.getByRole("button", { name: "Select Streetleaf" }));
    expect(roleNames()).toEqual(["Streetleaf Admin", "User"]);
    await fill("sam@streetleaf.com", "Sam");
    await send();
    await waitFor(() => expect(api.inviteUser).toHaveBeenCalled());
    expect((api.inviteUser as jest.Mock).mock.calls[0][0]).not.toHaveProperty("customerId");
  });

  it("says when no customer matches", async () => {
    await signIn("Streetleaf Admin", null);
    await renderForm();
    await fireEvent.changeText(await screen.findByLabelText("Search customers…"), "zzz");
    expect(screen.getByText("No matching customers.")).toBeTruthy();
  });

  it("keeps Send disabled until the email and name are valid, with the web's messages", async () => {
    await signIn("Customer Admin", "c1");
    await renderForm();
    const sendButton = () => screen.getByRole("button", { name: "Send invite" });
    expect(sendButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Email"), "nia@coastal");
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Name"), " ");
    expect(screen.getByText("Name is required.")).toBeTruthy();
    await fill("nia@coastal.com", "Nia");
    expect(sendButton().props.accessibilityState.disabled).toBe(false);
  });

  it("stays open with the server's error", async () => {
    await signIn("Customer Admin", "c1");
    const { onSent } = await renderForm({ inviteUser: jest.fn().mockRejectedValue(new ApiError("A user with that email already exists.", 409)) });
    await fill("nia@coastal.com", "Nia");
    await send();
    expect(await screen.findByText("A user with that email already exists.")).toBeTruthy();
    expect(onSent).not.toHaveBeenCalled();
  });
});

describe("Invite User in the Users list", () => {
  const usersApi = () =>
    fakeApi({
      listUsers: jest.fn().mockResolvedValue({
        users: [{ id: "u1", name: "Uma", email: "u@c.com", roleLabel: "User", status: "active", customerId: "c1", actions: { reinvite: false, changeRole: false, delete: false, transferOwnership: false } }],
      }),
      getMyCustomer: jest.fn().mockResolvedValue({ customer: { id: "c1", name: "Coastal Power" } }),
    });

  it("is offered to those who manage users, and confirms after sending", async () => {
    await signIn("Customer Admin", "c1");
    const api = usersApi();
    await render(<UsersListView />, { wrapper: withSignedInAuth(api) });
    await fireEvent.press(await screen.findByRole("button", { name: "Invite User" }));
    await fill("nia@coastal.com", "Nia");
    await send();
    expect(await screen.findByText("Invitation sent to nia@coastal.com.")).toBeTruthy();
    expect(screen.queryByTestId("invite-user-form")).toBeNull();
    await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(2));
  });

  it("isn't offered to plain Users", async () => {
    await signIn("User", "c1");
    await render(<UsersListView />, { wrapper: withSignedInAuth(usersApi()) });
    await screen.findByText("Uma");
    expect(screen.queryByRole("button", { name: "Invite User" })).toBeNull();
  });
});
