import { getCustomer, getCustomers, getUsers } from "@/lib/apim";
import { getSessionToken, getSessionUser } from "@/lib/session";
import { isCustomerScoped } from "@/lib/auth-role";
import { PageHeader } from "@/components/PageHeader";
import { Toolbar } from "@/components/Toolbar";
import { UsersTable } from "@/components/UsersTable";
import { InviteUserModal } from "@/components/InviteUserModal";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [sessionUser, token] = await Promise.all([getSessionUser(), getSessionToken()]);
  const isCustomerAdmin = sessionUser?.role === "Customer Admin";
  const isCustomerOwner = sessionUser?.role === "Customer Owner";
  const isStreetleafAdmin = sessionUser?.role === "Streetleaf Admin";

  // Viewing scope: who this person can see in the list at all. A Customer
  // Admin, a Customer Owner, and a "Customer User" (a plain User who does
  // belong to a customer) all only see their own customer's people — a
  // "Streetleaf User" (a plain User with no customer) sees everyone, same
  // as a Streetleaf Admin. Imported rather than reimplemented here, so
  // this can't drift out of sync with proxy.ts's own route enforcement.
  const customerScoped = isCustomerScoped(sessionUser?.role, sessionUser?.customerId);

  // Management capability: whether Delete/Invite/Re-invite show at all —
  // separate from viewing scope above. A plain User (Streetleaf or
  // Customer) never gets this, regardless of how much of the list they
  // can see. Streetleaf Admin, Customer Admin, and Customer Owner all get
  // it, but never for their own row (see currentUserId below) — deleting/
  // re-inviting yourself isn't a real scenario this UI needs to support.
  const canManageUsers = isStreetleafAdmin || isCustomerAdmin || isCustomerOwner;

  // Who can invite (or re-invite) a Customer Owner — i.e. transfer
  // ownership: a Streetleaf Admin (any customer), or the customer's own
  // current Customer Owner (transferring their own ownership to someone
  // else). A plain Customer Admin can't, even though they can otherwise
  // manage users same as an Owner — granting ownership isn't part of that.
  const canInviteOwner = isStreetleafAdmin || isCustomerOwner;

  // A Customer Admin/Owner only manages their own customer's users, and
  // can't browse/search the full customer list (that's Streetleaf-Admin-
  // only for their own invite flow) — so skip getCustomers() for them,
  // and instead fetch just their own customer record, to lock the invite
  // modal to it (no search, always that one customer). When it is
  // fetched, active: true keeps inactive customers out of the invite
  // modal's search results — no reason to invite someone into a
  // customer that's no longer active.
  const [allUsers, customers, ownCustomer] = await Promise.all([
    getUsers(token),
    isCustomerAdmin || isCustomerOwner
      ? Promise.resolve([])
      : getCustomers({ active: true }, token),
    (isCustomerAdmin || isCustomerOwner) && sessionUser?.customerId
      ? getCustomer(sessionUser.customerId, token)
      : Promise.resolve(undefined),
  ]);

  const users = customerScoped
    ? allUsers.filter((u) => u.customerId === sessionUser?.customerId)
    : allUsers;

  // Which customers already have a Customer Owner — drives whether
  // InviteUserModal's "this transfers ownership" warning shows when
  // "Customer Owner" is picked as the invite role: only meaningful once
  // there's an existing owner to actually transfer away from, not for a
  // customer that's never had one yet. Derived from `users` rather than
  // `allUsers` — for a Streetleaf Admin they're the same (users IS
  // allUsers, unfiltered), and for a locked-customer viewer (Customer
  // Admin/Owner), `users` is already scoped to the one customer they can
  // ever invite into anyway.
  const customersWithOwner = users
    .filter((u) => u.role === "Customer Owner" && u.customerId)
    .map((u) => u.customerId as string);

  return (
    <>
      <PageHeader
        title="Users"
        actions={
          canManageUsers && (
            <InviteUserModal
              customers={customers}
              lockedCustomer={ownCustomer}
              canInviteOwner={canInviteOwner}
              customersWithOwner={customersWithOwner}
            />
          )
        }
      />
      <Toolbar searchPlaceholder="Search users…" resultCount={`${users.length} users`} />
      <UsersTable
        users={users}
        canManageUsers={canManageUsers}
        currentUserId={sessionUser?.id}
        customerScoped={customerScoped}
        viewerIsStreetleafAdmin={isStreetleafAdmin}
      />
    </>
  );
}
