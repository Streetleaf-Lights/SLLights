import { Alert } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { UsersListView } from "@/users/UsersListView";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const none = { reinvite: false, changeRole: false, delete: false };
const all = { reinvite: true, changeRole: true, delete: true };
const userRow = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `u${n}`,
  name: `Person ${String(n).padStart(2, "0")}`,
  email: `p${n}@coastal.com`,
  roleLabel: "User",
  status: "active",
  customerName: "Coastal Power",
  actions: none,
  ...extra,
});

beforeEach(async () => {
  const token = makeToken({ sub: "sa", role: "Streetleaf Admin", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "sa", name: "S", email: "s@x.com", role: "Streetleaf Admin", customerId: null } });
});
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function renderUsers(users: unknown[], overrides: Record<string, jest.Mock> = {}) {
  const api = fakeApi({ listUsers: jest.fn().mockResolvedValue({ users }), ...overrides });
  await render(<UsersListView />, { wrapper: withSignedInAuth(api) });
  return api;
}
const card = (name: string) => screen.getByLabelText(new RegExp(`^${name},`));

describe("UsersListView", () => {
  it("shows name, email, role, status badge and (for staff) the customer", async () => {
    await renderUsers([
      userRow(1, { roleLabel: "Customer Admin", status: "active" }),
      userRow(2, { status: "pending", customerName: null }),
    ]);
    expect(await screen.findByText("Person 01")).toBeTruthy();
    expect(screen.getByText("p1@coastal.com")).toBeTruthy();
    expect(screen.getByText("Customer Admin")).toBeTruthy();
    expect(within(card("Person 01")).getByText("Active")).toBeTruthy();
    expect(within(card("Person 02")).getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Coastal Power")).toBeTruthy();
    expect(within(card("Person 02")).getByText("Streetleaf")).toBeTruthy(); // no customer
    expect(screen.getByText("2 users")).toBeTruthy();
  });

  it("has no customer line for customer-scoped viewers (the server omits it)", async () => {
    await renderUsers([userRow(1, { customerName: undefined, roleLabel: "Admin" })]);
    await screen.findByText("Person 01");
    expect(screen.queryByText("Coastal Power")).toBeNull();
  });

  it("searches name, email and customer, and pages 10 at a time", async () => {
    await renderUsers(Array.from({ length: 23 }, (_, i) => userRow(i + 1)));
    expect(await screen.findByText("Showing 1–10 of 23 users")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Person 11")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Search users…"), "p2@");
    expect(screen.getByText("1 user")).toBeTruthy(); // back to page 1, one match
    expect(screen.getByText("Person 02")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Search users…"), "zzz");
    expect(screen.getByText("No users match your search.")).toBeTruthy();
  });

  it("shows only the actions the server allows on each row", async () => {
    await renderUsers([
      userRow(1, { actions: none }),
      userRow(2, { actions: { reinvite: false, changeRole: false, delete: true } }),
      userRow(3, { status: "pending", actions: all }),
    ]);
    await screen.findByText("Person 01");
    expect(within(card("Person 01")).queryByRole("button")).toBeNull();
    expect(within(card("Person 02")).getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual(["Delete"]);
    expect(within(card("Person 03")).getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "Re-invite",
      "Change Role",
      "Delete",
    ]);
  });

  it("re-invites and says so", async () => {
    const api = await renderUsers([userRow(3, { status: "pending", actions: all })]);
    await fireEvent.press(await screen.findByRole("button", { name: "Re-invite" }));
    expect(await screen.findByText("Invite re-sent to p3@coastal.com.")).toBeTruthy();
    expect(api.reinviteUser).toHaveBeenCalledWith("u3");
  });

  it("changes a role, reports the new role and refreshes the list", async () => {
    const api = await renderUsers([userRow(3, { actions: all })], {
      changeUserRole: jest.fn().mockResolvedValue({ roleLabel: "Admin" }),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Change Role" }));
    expect(await screen.findByText("Role changed to Admin.")).toBeTruthy();
    await waitFor(() => expect(api.listUsers).toHaveBeenCalledTimes(2));
  });

  it("asks before deleting, and only deletes on confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const api = await renderUsers([userRow(3, { actions: all })]);
    await fireEvent.press(await screen.findByRole("button", { name: "Delete" }));
    expect(alert).toHaveBeenCalledWith("Delete user?", expect.stringContaining("Person 03"), expect.any(Array));
    expect(api.deleteUser).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Delete")?.onPress?.());
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith("u3"));
    expect(await screen.findByText("Person 03 was deleted.")).toBeTruthy();
  });

  it("cancelling the delete does nothing", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const api = await renderUsers([userRow(3, { actions: all })]);
    await fireEvent.press(await screen.findByRole("button", { name: "Delete" }));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Cancel")?.onPress?.();
    expect(api.deleteUser).not.toHaveBeenCalled();
  });

  it("shows the server's refusal on the row", async () => {
    await renderUsers([userRow(3, { actions: all })], {
      changeUserRole: jest.fn().mockRejectedValue(new ApiError("You can't do that for this user.", 403)),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Change Role" }));
    expect(await screen.findByText("You can't do that for this user.")).toBeTruthy();
  });
});
