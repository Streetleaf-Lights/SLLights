import { describe, expect, it } from "vitest";
import { canManageUsers, canSeeUser, userActions, userRoleLabel, userStatus } from "../users";

const viewer = (role: string, customerId: string | null = null, id = "me") => ({ id, role, customerId });
const user = (role: string, extra: Partial<{ id: string; status: string; customerId: string | null }> = {}) => ({
  id: "them",
  role,
  status: "Active",
  customerId: "c1",
  ...extra,
});

describe("labels", () => {
  it("maps statuses like the web badge", () => {
    expect(userStatus("Active")).toBe("active");
    expect(userStatus("PENDING")).toBe("pending");
    expect(userStatus("Disabled")).toBe("inactive");
    expect(userStatus(null)).toBe("inactive");
  });

  it("shortens customer roles only for customer-scoped viewers", () => {
    expect(userRoleLabel("Customer Admin", true)).toBe("Admin");
    expect(userRoleLabel("Customer Owner", true)).toBe("Owner");
    expect(userRoleLabel("Customer Admin", false)).toBe("Customer Admin");
    expect(userRoleLabel("User", true)).toBe("User");
  });
});

describe("who manages and who is seen", () => {
  it.each([
    ["Streetleaf Admin", true],
    ["Customer Admin", true],
    ["Customer Owner", true],
    ["User", false],
    ["Streetleaf Crew", false],
  ])("%s manages users: %s", (role, expected) => expect(canManageUsers(role)).toBe(expected));

  it("limits customer-scoped viewers to their own customer", () => {
    expect(canSeeUser(viewer("Customer Admin", "c1"), { customerId: "c1" })).toBe(true);
    expect(canSeeUser(viewer("Customer Admin", "c1"), { customerId: "c2" })).toBe(false);
    expect(canSeeUser(viewer("Streetleaf Admin"), { customerId: "c2" })).toBe(true);
  });
});

describe("userActions (the web table's rules)", () => {
  it("gives plain Users no actions", () => {
    expect(userActions(viewer("User", "c1"), user("User"))).toEqual({ reinvite: false, changeRole: false, delete: false });
  });

  it("gives managers Change Role and Delete on others, plus Re-invite when pending", () => {
    expect(userActions(viewer("Customer Admin", "c1"), user("User"))).toEqual({ reinvite: false, changeRole: true, delete: true });
    expect(userActions(viewer("Customer Owner", "c1"), user("User", { status: "Pending" }))).toEqual({
      reinvite: true,
      changeRole: true,
      delete: true,
    });
  });

  it("never lets anyone change or delete themselves", () => {
    expect(userActions(viewer("Streetleaf Admin", null, "me"), user("Streetleaf Admin", { id: "me", customerId: null }))).toEqual({
      reinvite: false,
      changeRole: false,
      delete: false,
    });
  });

  it("protects a Customer Owner: only a Streetleaf Admin may delete them, nobody changes their role", () => {
    expect(userActions(viewer("Streetleaf Admin"), user("Customer Owner"))).toEqual({ reinvite: false, changeRole: false, delete: true });
    expect(userActions(viewer("Customer Admin", "c1"), user("Customer Owner"))).toEqual({ reinvite: false, changeRole: false, delete: false });
    expect(userActions(viewer("Customer Owner", "c1", "me"), user("Customer Owner", { id: "me" })).delete).toBe(false);
  });

  it("gives nothing on another customer's user", () => {
    expect(userActions(viewer("Customer Admin", "c1"), user("User", { customerId: "c2" }))).toEqual({
      reinvite: false,
      changeRole: false,
      delete: false,
    });
  });
});
