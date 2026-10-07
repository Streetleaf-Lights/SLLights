import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { testToken } from "@/testing/testToken";

const { usersMock, deleteMock, reinviteMock, changeRoleMock, revalidateMock, inviteMock, customersMock } = vi.hoisted(() => ({
  customersMock: vi.fn(),
  inviteMock: vi.fn(),
  usersMock: vi.fn(),
  deleteMock: vi.fn(),
  reinviteMock: vi.fn(),
  changeRoleMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidateTag: revalidateMock }));
vi.mock("@/lib/apim", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apim")>("@/lib/apim");
  return {
    ...actual,
    getUsers: usersMock,
    deleteUser: deleteMock,
    resendInvite: reinviteMock,
    changeRole: changeRoleMock,
    inviteUser: inviteMock,
    getCustomers: customersMock,
  };
});

import { ApimError } from "@/lib/apim";
import { GET } from "@/app/api/mobile/users/route";
import { DELETE } from "@/app/api/mobile/users/[userId]/route";
import { POST as REINVITE } from "@/app/api/mobile/users/[userId]/reinvite/route";
import { POST as CHANGE_ROLE } from "@/app/api/mobile/users/[userId]/role/route";
import { POST as TRANSFER } from "@/app/api/mobile/users/[userId]/transfer-ownership/route";
import { POST as INVITE } from "@/app/api/mobile/users/invite/route";

const exp = Math.floor(Date.now() / 1000) + 3600;
const token = (sub: string, role: string, customerId?: string) => testToken({ sub, role, exp, ...(customerId ? { customerId } : {}) });
const sa = token("sa", "Streetleaf Admin");
const ca1 = token("ca1", "Customer Admin", "c1");
const owner1 = token("own1", "Customer Owner", "c1");
const user1 = token("u1", "User", "c1");
const expired = testToken({ sub: "ca1", role: "Customer Admin", customerId: "c1", exp: 1 });

const people = [
  { id: "sa", name: "Sam Admin", email: "sa@s.com", role: "Streetleaf Admin", status: "Active", customerId: null, customerName: null },
  { id: "ca1", name: "Cal Admin", email: "ca@c1.com", role: "Customer Admin", status: "Active", customerId: "c1", customerName: "Coastal" },
  { id: "own1", name: "Olive Owner", email: "o@c1.com", role: "Customer Owner", status: "Active", customerId: "c1", customerName: "Coastal" },
  { id: "u1", name: "Uma User", email: "u@c1.com", role: "User", status: "Pending", customerId: "c1", customerName: "Coastal" },
  { id: "u2", name: "Other Person", email: "x@c2.com", role: "User", status: "Pending", customerId: "c2", customerName: "Harbor" },
];

beforeEach(() => {
  usersMock.mockResolvedValue(people);
  changeRoleMock.mockResolvedValue({ userId: "u1", role: "Customer Admin", customerId: "c1" });
  deleteMock.mockResolvedValue(undefined);
  reinviteMock.mockResolvedValue(undefined);
});
afterEach(() => [usersMock, deleteMock, reinviteMock, changeRoleMock, revalidateMock].forEach((m) => m.mockReset()));

const req = (t: string | null, method = "GET", path = "/api/mobile/users") =>
  new NextRequest(`http://localhost${path}`, { method, headers: t ? { authorization: `Bearer ${t}` } : {} });
const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });
const act = {
  delete: (t: string | null, id: string) => DELETE(req(t, "DELETE"), ctx(id)),
  reinvite: (t: string | null, id: string) => REINVITE(req(t, "POST"), ctx(id)),
  role: (t: string | null, id: string) => CHANGE_ROLE(req(t, "POST"), ctx(id)),
};

describe("GET /api/mobile/users", () => {
  it("shows Streetleaf staff everyone, with the Customer column and full role names", async () => {
    const body = await (await GET(req(sa))).json();
    expect(body.users).toHaveLength(5);
    expect(body.users[1]).toMatchObject({ roleLabel: "Customer Admin", customerName: "Coastal", customerId: "c1", status: "active" });
  });

  it("shows a customer's people only their own customer, with short role names and no Customer column", async () => {
    const body = await (await GET(req(ca1))).json();
    expect(body.users.map((u: { id: string }) => u.id)).toEqual(["ca1", "own1", "u1"]);
    expect(body.users[1].roleLabel).toBe("Owner");
    expect(body.users[0]).not.toHaveProperty("customerName");
  });

  it("includes each row's allowed actions", async () => {
    const byId = Object.fromEntries((await (await GET(req(ca1))).json()).users.map((u: { id: string; actions: unknown }) => [u.id, u.actions]));
    expect(byId.ca1).toEqual({ reinvite: false, changeRole: false, delete: false, transferOwnership: false }); // self
    expect(byId.own1).toEqual({ reinvite: false, changeRole: false, delete: false, transferOwnership: false }); // Owner, viewer isn't SA
    expect(byId.u1).toEqual({ reinvite: true, changeRole: true, delete: true, transferOwnership: false }); // pending user
  });

  it("gives a plain User the list but no actions", async () => {
    const body = await (await GET(req(user1))).json();
    expect(body.users.every((u: { actions: Record<string, boolean> }) => !Object.values(u.actions).some(Boolean))).toBe(true);
  });

  it.each([["missing", null], ["malformed", "x.y"], ["expired", expired]])("401s a %s token", async (_l, t) => {
    expect((await GET(req(t))).status).toBe(401);
  });
});

describe("user actions are enforced on the server", () => {
  it("lets a Customer Admin act on their own customer's user", async () => {
    expect((await act.reinvite(ca1, "u1")).status).toBe(200);
    expect(reinviteMock).toHaveBeenCalledWith("u1", ca1);
    const changed = await act.role(ca1, "u1");
    expect(await changed.json()).toEqual({ roleLabel: "Admin" });
    expect((await act.delete(ca1, "u1")).status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("u1", ca1);
    expect(revalidateMock).toHaveBeenCalledWith("users", { expire: 0 }); // list refreshes after change/delete
  });

  it.each(["delete", "reinvite", "role"] as const)("404s %s on another customer's user, without calling APIM", async (a) => {
    expect((await act[a](ca1, "u2")).status).toBe(404);
    expect(await act[a](ca1, "nobody").then((r) => r.status)).toBe(404);
    for (const m of [deleteMock, reinviteMock, changeRoleMock]) expect(m).not.toHaveBeenCalled();
  });

  it.each(["delete", "reinvite", "role"] as const)("403s %s by a plain User", async (a) => {
    expect((await act[a](user1, "u1")).status).toBe(403);
  });

  it("protects a Customer Owner: only a Streetleaf Admin may delete them; nobody changes their role", async () => {
    expect((await act.delete(ca1, "own1")).status).toBe(403);
    expect((await act.role(ca1, "own1")).status).toBe(403);
    expect((await act.role(sa, "own1")).status).toBe(403);
    expect((await act.delete(sa, "own1")).status).toBe(200);
  });

  it("never lets anyone change or delete themselves", async () => {
    expect((await act.delete(ca1, "ca1")).status).toBe(403);
    expect((await act.role(ca1, "ca1")).status).toBe(403);
    expect((await act.delete(owner1, "own1")).status).toBe(403);
  });

  it("only re-invites Pending users", async () => {
    expect((await act.reinvite(sa, "ca1")).status).toBe(403); // Active
    expect((await act.reinvite(sa, "u2")).status).toBe(200);
  });

  it("401s without a valid token, without looking anyone up", async () => {
    expect((await act.delete(null, "u1")).status).toBe(401);
    expect((await act.role(expired, "u1")).status).toBe(401);
    expect(usersMock).not.toHaveBeenCalled();
  });

  it("passes APIM's own refusal through", async () => {
    changeRoleMock.mockRejectedValueOnce(new ApimError("Only Streetleaf Admins or Customer Admins can change roles.", 400));
    const res = await act.role(owner1, "u1");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/can change roles/);
  });
});

describe("POST …/users/{ownerId}/transfer-ownership", () => {
  const transfer = (t: string | null, ownerId: string, body: unknown) =>
    TRANSFER(
      new NextRequest(`http://localhost/api/mobile/users/${ownerId}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      ctx(ownerId),
    );
  const newOwner = { name: " Nia New ", email: " nia@coastal.com " };

  beforeEach(() => {
    inviteMock.mockResolvedValue({ userId: "new" });
  });
  afterEach(() => inviteMock.mockReset());

  it("lets the Owner invite their replacement for their own customer", async () => {
    const res = await transfer(owner1, "own1", newOwner);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, customerName: "Coastal" });
    expect(inviteMock).toHaveBeenCalledWith(
      { name: "Nia New", email: "nia@coastal.com", role: "Customer Owner", customerId: "c1" },
      owner1,
    );
    expect(revalidateMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("lets a Streetleaf Admin transfer any customer's ownership", async () => {
    expect((await transfer(sa, "own1", newOwner)).status).toBe(200);
  });

  it("ignores any customer or role named in the request", async () => {
    await transfer(owner1, "own1", { ...newOwner, customerId: "c2", role: "Streetleaf Admin" });
    expect(inviteMock).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer Owner", customerId: "c1" }), owner1);
  });

  it("refuses a Customer Admin, a plain User, or a target who isn't an Owner — without inviting anyone", async () => {
    expect((await transfer(ca1, "own1", newOwner)).status).toBe(403);
    expect((await transfer(user1, "own1", newOwner)).status).toBe(403);
    expect((await transfer(sa, "u1", newOwner)).status).toBe(403); // not an Owner
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("404s an Owner of another customer, or an unknown user", async () => {
    usersMock.mockResolvedValue([
      ...people,
      { id: "own2", name: "Other Owner", email: "o@c2.com", role: "Customer Owner", status: "Active", customerId: "c2", customerName: "Harbor" },
    ]);
    expect((await transfer(owner1, "own2", newOwner)).status).toBe(404);
    expect((await transfer(owner1, "nobody", newOwner)).status).toBe(404);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["no name", { name: " ", email: "nia@coastal.com" }],
    ["bad email", { name: "Nia", email: "nia@coastal" }],
  ])("400s %s, without inviting anyone", async (_l, body) => {
    expect((await transfer(owner1, "own1", body)).status).toBe(400);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("401s without a valid token", async () => {
    expect((await transfer(null, "own1", newOwner)).status).toBe(401);
    expect((await transfer(expired, "own1", newOwner)).status).toBe(401);
  });

  it("passes APIM's own refusal through", async () => {
    inviteMock.mockRejectedValueOnce(new ApimError("A user with that email already exists.", 409));
    const res = await transfer(owner1, "own1", newOwner);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("A user with that email already exists.");
  });
});

describe("POST /api/mobile/users/invite", () => {
  const invite = (t: string | null, body: unknown) =>
    INVITE(
      new NextRequest("http://localhost/api/mobile/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  const person = { name: " Nia New ", email: " nia@x.com " };

  beforeEach(() => {
    inviteMock.mockResolvedValue({ userId: "new" });
    customersMock.mockResolvedValue([
      { id: "c1", name: "Coastal" },
      { id: "c2", name: "Harbor" },
      { id: "sl", name: "Streetleaf " },
    ]);
  });
  afterEach(() => {
    inviteMock.mockReset();
    customersMock.mockReset();
  });

  it("lets a Customer Admin invite an Admin or User into their own customer", async () => {
    const res = await invite(ca1, { ...person, role: "User" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, role: "User", customerName: null });
    expect(inviteMock).toHaveBeenCalledWith({ name: "Nia New", email: "nia@x.com", role: "User", customerId: "c1" }, ca1);
    expect(revalidateMock).toHaveBeenCalledWith("users", { expire: 0 });
  });

  it("always invites a Customer Admin/Owner's people into their own customer, ignoring any customerId sent", async () => {
    await invite(ca1, { ...person, role: "Customer Admin", customerId: "c2" });
    expect(inviteMock).toHaveBeenCalledWith(expect.objectContaining({ customerId: "c1" }), ca1);
    expect(customersMock).not.toHaveBeenCalled();
  });

  it("refuses roles outside the viewer's options — no escalation", async () => {
    expect((await invite(ca1, { ...person, role: "Streetleaf Admin" })).status).toBe(403);
    expect((await invite(ca1, { ...person, role: "Customer Owner" })).status).toBe(403); // only Owners/SA may
    expect((await invite(owner1, { ...person, role: "Streetleaf Admin" })).status).toBe(403);
    expect((await invite(ca1, { ...person, role: "Streetleaf Crew" })).status).toBe(403);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("lets a Customer Owner invite a new Owner for their own customer", async () => {
    expect((await invite(owner1, { ...person, role: "Customer Owner" })).status).toBe(200);
    expect(inviteMock).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer Owner", customerId: "c1" }), owner1);
  });

  it("lets a Streetleaf Admin invite into a chosen customer", async () => {
    const res = await invite(sa, { ...person, role: "Customer Owner", customerId: "c2" });
    expect(await res.json()).toEqual({ success: true, role: "Customer Owner", customerName: "Harbor" });
    expect(inviteMock).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer Owner", customerId: "c2" }), sa);
  });

  it("makes a Streetleaf Admin's invite with no customer (or the 'Streetleaf' record) a Streetleaf invite", async () => {
    await invite(sa, { ...person, role: "Streetleaf Admin" });
    expect(inviteMock).toHaveBeenLastCalledWith({ name: "Nia New", email: "nia@x.com", role: "Streetleaf Admin" }, sa);
    await invite(sa, { ...person, role: "Streetleaf Admin", customerId: "sl" });
    expect(inviteMock).toHaveBeenLastCalledWith({ name: "Nia New", email: "nia@x.com", role: "Streetleaf Admin" }, sa);
  });

  it("matches roles to the customer context for a Streetleaf Admin", async () => {
    expect((await invite(sa, { ...person, role: "Customer Admin" })).status).toBe(403); // no customer chosen
    expect((await invite(sa, { ...person, role: "Streetleaf Admin", customerId: "c1" })).status).toBe(403); // customer chosen
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("refuses a customer that isn't an active customer", async () => {
    expect((await invite(sa, { ...person, role: "Customer Admin", customerId: "gone" })).status).toBe(400);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("403s plain Users, and 401s without a valid token", async () => {
    expect((await invite(user1, { ...person, role: "User" })).status).toBe(403);
    expect((await invite(null, { ...person, role: "User" })).status).toBe(401);
    expect((await invite(expired, { ...person, role: "User" })).status).toBe(401);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{nope"],
    ["no name", { name: "", email: "nia@x.com", role: "User" }],
    ["bad email", { name: "Nia", email: "nia@x", role: "User" }],
    ["no role", { name: "Nia", email: "nia@x.com" }],
  ])("400s %s", async (_l, body) => {
    expect((await invite(ca1, body)).status).toBe(400);
    expect(inviteMock).not.toHaveBeenCalled();
  });

  it("passes APIM's own refusal through", async () => {
    inviteMock.mockRejectedValueOnce(new ApimError("A user with that email already exists.", 409));
    expect((await invite(ca1, { ...person, role: "User" })).status).toBe(409);
  });
});
