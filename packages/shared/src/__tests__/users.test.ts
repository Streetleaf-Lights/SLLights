import { describe, expect, it } from "vitest";
import { canManageUsers, canSeeUser, userActions, userRoleLabel, userStatus, validateNewOwner } from "../users";

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
    expect(userActions(viewer("User", "c1"), user("User"))).toEqual({ reinvite: false, changeRole: false, delete: false, transferOwnership: false });
  });

  it("gives managers Change Role and Delete on others, plus Re-invite when pending", () => {
    expect(userActions(viewer("Customer Admin", "c1"), user("User"))).toEqual({ reinvite: false, changeRole: true, delete: true, transferOwnership: false });
    expect(userActions(viewer("Customer Owner", "c1"), user("User", { status: "Pending" }))).toEqual({
      reinvite: true,
      changeRole: true,
      delete: true,
      transferOwnership: false,
    });
  });

  it("never lets anyone change or delete themselves", () => {
    expect(userActions(viewer("Streetleaf Admin", null, "me"), user("Streetleaf Admin", { id: "me", customerId: null }))).toEqual({
      reinvite: false,
      changeRole: false,
      delete: false,
      transferOwnership: false,
    });
  });

  it("protects a Customer Owner: only a Streetleaf Admin may delete them, nobody changes their role", () => {
    expect(userActions(viewer("Streetleaf Admin"), user("Customer Owner"))).toEqual({ reinvite: false, changeRole: false, delete: true, transferOwnership: true });
    expect(userActions(viewer("Customer Admin", "c1"), user("Customer Owner"))).toEqual({ reinvite: false, changeRole: false, delete: false, transferOwnership: false });
    expect(userActions(viewer("Customer Owner", "c1", "me"), user("Customer Owner", { id: "me" })).delete).toBe(false);
  });

  it("gives nothing on another customer's user", () => {
    expect(userActions(viewer("Customer Admin", "c1"), user("User", { customerId: "c2" }))).toEqual({
      reinvite: false,
      changeRole: false,
      delete: false,
      transferOwnership: false,
    });
  });
});

describe("Transfer Ownership", () => {
  it("is offered to the Owner on their own row, and to a Streetleaf Admin on any Owner's row", () => {
    expect(userActions(viewer("Customer Owner", "c1", "me"), user("Customer Owner", { id: "me" })).transferOwnership).toBe(true);
    expect(userActions(viewer("Streetleaf Admin"), user("Customer Owner", { customerId: "c9" })).transferOwnership).toBe(true);
  });

  it("isn't offered to a Customer Admin, a plain User, on another customer's Owner, or on a non-Owner", () => {
    expect(userActions(viewer("Customer Admin", "c1"), user("Customer Owner")).transferOwnership).toBe(false);
    expect(userActions(viewer("User", "c1"), user("Customer Owner")).transferOwnership).toBe(false);
    expect(userActions(viewer("Customer Owner", "c2", "me"), user("Customer Owner")).transferOwnership).toBe(false);
    expect(userActions(viewer("Streetleaf Admin"), user("Customer Admin")).transferOwnership).toBe(false);
    expect(userActions(viewer("Streetleaf Admin"), user("Customer Owner", { customerId: null })).transferOwnership).toBe(false);
  });

  it("validates the new owner like the web invite form", () => {
    expect(validateNewOwner({ name: "  Nia New ", email: " nia@coastal.com " })).toEqual({
      ok: true,
      value: { name: "Nia New", email: "nia@coastal.com" },
    });
    expect(validateNewOwner({ name: "", email: "nia@coastal.com" })).toMatchObject({ ok: false });
    expect(validateNewOwner({ name: "Nia", email: "nia@coastal" })).toMatchObject({ ok: false });
    expect(validateNewOwner({ name: "Nia", email: "nia @coastal.com" })).toMatchObject({ ok: false });
    expect(validateNewOwner(null)).toMatchObject({ ok: false });
  });
});

import { inviteRoleOptions, isStreetleafCustomerName } from "../users";

describe("Invite User rules (as the web form)", () => {
  it("offers roles by who is inviting and whether a customer is chosen, default first", () => {
    expect(inviteRoleOptions("Customer Admin", true)).toEqual(["Customer Admin", "User"]);
    expect(inviteRoleOptions("Customer Owner", true)).toEqual(["Customer Admin", "User", "Customer Owner"]);
    expect(inviteRoleOptions("Streetleaf Admin", true)).toEqual(["Customer Admin", "User", "Customer Owner"]);
    expect(inviteRoleOptions("Streetleaf Admin", false)).toEqual(["Streetleaf Admin", "User"]);
  });

  it("never lets a customer's admin or owner grant Streetleaf Admin", () => {
    expect(inviteRoleOptions("Customer Admin", false)).not.toContain("Streetleaf Admin");
    expect(inviteRoleOptions("Customer Owner", false)).not.toContain("Streetleaf Admin");
  });

  it("gives everyone else nothing", () => {
    expect(inviteRoleOptions("User", true)).toEqual([]);
    expect(inviteRoleOptions("Streetleaf Crew", false)).toEqual([]);
    expect(inviteRoleOptions(null, false)).toEqual([]);
  });

  it("treats the 'Streetleaf' customer record (with its trailing space) as Streetleaf itself", () => {
    expect(isStreetleafCustomerName("Streetleaf ")).toBe(true);
    expect(isStreetleafCustomerName("Streetleaf")).toBe(true);
    expect(isStreetleafCustomerName("Streetleaf Lighting")).toBe(false);
    expect(isStreetleafCustomerName(null)).toBe(false);
  });
});
