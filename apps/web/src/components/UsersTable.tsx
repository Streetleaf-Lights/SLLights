"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { Pagination } from "@/components/Pagination";
import { InviteUserModal } from "@/components/InviteUserModal";
import { initials } from "@/lib/text";

const PAGE_SIZE = 10;

function statusBadgeKind(status: string | null | undefined): "active" | "pending" | "inactive" {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "pending") return "pending";
  return "inactive";
}

/**
 * "Customer" is implied by the whole view already being scoped to one, so
 * customer-scoped viewers see the shorter "Admin"/"Owner" instead of
 * "Customer Admin"/"Customer Owner". Unaffected (and unabbreviated)
 * outside a customer-scoped view, and for any other role value.
 */
function customerScopedRoleLabel(role: string, customerScoped: boolean): string {
  if (!customerScoped) return role;
  if (role === "Customer Admin") return "Admin";
  if (role === "Customer Owner") return "Owner";
  return role;
}

type UserAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function UsersTable({
  users,
  canManageUsers = true,
  currentUserId,
  customerScoped = false,
  viewerIsStreetleafAdmin = false,
}: {
  users: User[];
  canManageUsers?: boolean;
  currentUserId?: string | null;
  /**
   * True when the viewer (Customer Admin or "Customer User") only ever
   * sees their own customer's people — the Customer column is then
   * redundant (every row is the same customer) and gets hidden, and
   * "Customer Admin" is shortened to "Admin" since "Customer" is implied
   * by the whole view already being scoped to one.
   */
  customerScoped?: boolean;
  /**
   * Only a Streetleaf Admin gets two extra powers over a Customer Owner
   * row: deleting it directly, and "Transfer Ownership" in place of the
   * (otherwise inapplicable) Change Role action — see
   * getApplicableActions below for why these are scoped this narrowly.
   */
  viewerIsStreetleafAdmin?: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reinvitingUserId, setReinvitingUserId] = useState<string | null>(null);
  const [reinviteResult, setReinviteResult] = useState<{
    userId: string;
    text: string;
    isError: boolean;
  } | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);
  const [changeRoleResult, setChangeRoleResult] = useState<{
    userId: string;
    text: string;
    isError: boolean;
  } | null>(null);
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuUserId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuUserId(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuUserId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMenuUserId]);

  function closeConfirm() {
    setPendingDelete(null);
    setDeleting(false);
    setDeleteError(null);
  }

  async function handleChangeRole(user: User) {
    setChangingRoleUserId(user.id);
    setChangeRoleResult(null);
    try {
      const res = await fetch("/api/changerole", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 401) {
        // Same reasoning as handleConfirmDelete — an inline error here
        // would be a dead end, since retrying would just fail the same way.
        router.push("/signin");
        router.refresh();
        return;
      }

      if (!res.ok) {
        setChangeRoleResult({
          userId: user.id,
          text: body?.error ?? "Change role failed. Please try again.",
          isError: true,
        });
        return;
      }

      const displayRole =
        customerScoped && body?.role === "Customer Admin" ? "Admin" : (body?.role ?? "—");
      setChangeRoleResult({
        userId: user.id,
        text: `Role changed to ${displayRole}.`,
        isError: false,
      });
      // Users page is server-rendered (force-dynamic) — refresh re-fetches
      // getUsers() so the new role shows in the Role column right away.
      router.refresh();
    } catch {
      setChangeRoleResult({
        userId: user.id,
        text: "Something went wrong. Please try again.",
        isError: true,
      });
    } finally {
      setChangingRoleUserId(null);
    }
  }

  async function handleReinvite(user: User) {
    setReinvitingUserId(user.id);
    setReinviteResult(null);
    try {
      const res = await fetch("/api/resendinvite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 401) {
        // Same reasoning as handleConfirmDelete — an inline error here
        // would be a dead end, since retrying would just fail the same way.
        router.push("/signin");
        router.refresh();
        return;
      }

      if (!res.ok) {
        setReinviteResult({
          userId: user.id,
          text: body?.error ?? "Resend failed. Please try again.",
          isError: true,
        });
        return;
      }

      setReinviteResult({ userId: user.id, text: "Invite sent.", isError: false });
    } catch {
      setReinviteResult({
        userId: user.id,
        text: "Something went wrong. Please try again.",
        isError: true,
      });
    } finally {
      setReinvitingUserId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/deleteuser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pendingDelete.id }),
      });
      const body = await res.json().catch(() => null);

      if (res.status === 401) {
        // The session actually expired server-side (see the cookie-maxAge
        // fix in /api/signin) — an inline error here would be a dead end,
        // since retrying would just fail the same way. Send them to sign
        // back in instead.
        router.push("/signin");
        router.refresh();
        return;
      }

      if (!res.ok) {
        setDeleteError(body?.error ?? "Delete failed. Please try again.");
        setDeleting(false);
        return;
      }

      closeConfirm();
      // Users page is server-rendered (force-dynamic) — refresh re-fetches
      // getUsers() so the deleted user disappears right away, same as
      // InviteUserModal does after a successful invite.
      router.refresh();
    } catch {
      setDeleteError("Something went wrong. Please try again.");
      setDeleting(false);
    }
  }

  /**
   * What's applicable for this row, in menu order. Re-invite only for a
   * still-pending invite. For a Customer Owner row, Change Role never
   * applies — changeRole only ever toggles User <-> Admin server-side
   * (see apim.ts), which isn't well-defined for an Owner. Transfer
   * Ownership takes its place instead, reusing the Invite flow (see
   * InviteUserModal's Customer Owner option) rather than this row's own
   * action, since transferring ownership is fundamentally an invite-and-
   * accept flow, not a role toggle — offered to the Owner viewing their
   * own row (transferring their own ownership) or a Streetleaf Admin
   * viewing someone else's Owner row, never to anyone else (e.g. a plain
   * Customer Admin). Delete never applies to your own row regardless of
   * role (self-deletion isn't supported anywhere in this table) — beyond
   * that, a Streetleaf Admin can delete the sole Owner directly, but
   * everyone else must go through the Transfer Ownership flow above,
   * which removes the previous owner automatically once the new one
   * accepts. For anyone else's row that isn't a Customer Owner, both
   * Change Role and Delete apply normally.
   */
  function getApplicableActions(user: User): UserAction[] {
    const actions: UserAction[] = [];
    const isSelf = user.id === currentUserId;
    const isOwner = user.role === "Customer Owner";

    if (statusBadgeKind(user.status) === "pending") {
      actions.push({
        key: "reinvite",
        label: reinvitingUserId === user.id ? "Sending…" : "Re-invite",
        onClick: () => handleReinvite(user),
        disabled: reinvitingUserId === user.id,
      });
    }

    if (isOwner) {
      if ((isSelf || viewerIsStreetleafAdmin) && user.customerId) {
        actions.push({
          key: "transferOwnership",
          label: "Transfer Ownership",
          onClick: () =>
            setTransferTarget({ id: user.customerId as string, name: user.customerName ?? "" }),
        });
      }
      if (!isSelf && viewerIsStreetleafAdmin) {
        actions.push({
          key: "delete",
          label: "Delete",
          onClick: () => setPendingDelete(user),
          destructive: true,
        });
      }
      return actions;
    }

    if (isSelf) return actions;

    actions.push({
      key: "changeRole",
      label: changingRoleUserId === user.id ? "Changing…" : "Change Role",
      onClick: () => handleChangeRole(user),
      disabled: changingRoleUserId === user.id,
    });
    actions.push({
      key: "delete",
      label: "Delete",
      onClick: () => setPendingDelete(user),
      destructive: true,
    });
    return actions;
  }

  // Which customers already have a Customer Owner — passed to the
  // Transfer Ownership modal below so its "this transfers ownership"
  // warning only shows for a customer that already has an owner (which,
  // for that specific flow, is always true — Transfer Ownership only
  // ever appears on a row that already holds Customer Owner, i.e. proof
  // that customer has one — but deriving it the same way InviteUserModal
  // expects keeps this in sync rather than hardcoding that assumption).
  const customersWithOwner = users
    .filter((u) => u.role === "Customer Owner" && u.customerId)
    .map((u) => u.customerId as string);

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="mx-8 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-sunken)] text-[11.5px] uppercase tracking-wide text-[var(--ink-muted)]">
              <th className="py-2.5 pl-4 pr-4 font-medium">Name</th>
              <th className="py-2.5 pr-4 font-medium">Email</th>
              <th className="py-2.5 pr-4 font-medium">Role</th>
              <th className="py-2.5 pr-4 font-medium">Status</th>
              {!customerScoped && <th className="py-2.5 pr-4 font-medium">Customer</th>}
              {canManageUsers && <th className="py-2.5 pr-8 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user, index) => (
              <tr
                key={user.id}
                className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-sunken)]"
              >
                <td className="py-3 pl-4 pr-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent-ink)]">
                      {initials(user.name)}
                    </span>
                    <span className="font-medium text-[var(--ink)]">{user.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 font-mono-data text-[12px] text-[var(--ink-muted)]">
                  {user.email}
                </td>
                <td className="py-3 pr-4 text-[var(--ink)]">
                  {customerScopedRoleLabel(user.role, customerScoped)}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={statusBadgeKind(user.status)} />
                </td>
                {!customerScoped && (
                  <td className="py-3 pr-4 text-[var(--ink)]">
                    {user.customerId === null ? "Streetleaf" : user.customerName}
                  </td>
                )}
                {canManageUsers &&
                  (() => {
                    const actions = getApplicableActions(user);
                    const isMenuOpen = openMenuUserId === user.id;
                    // The table's own wrapper clips to its rounded corners
                    // with overflow-hidden, which would also clip this
                    // menu if it opened downward past the wrapper's
                    // bottom edge — only reachable from the last row, so
                    // that one opens upward instead.
                    const isLastRow = index === pageUsers.length - 1;
                    return (
                      <td className="py-3 pr-8 text-right">
                        {actions.length === 0 ? null : (
                          <div
                            className="relative inline-block text-left"
                            ref={isMenuOpen ? menuRef : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => setOpenMenuUserId(isMenuOpen ? null : user.id)}
                              aria-haspopup="menu"
                              aria-expanded={isMenuOpen}
                              aria-label={`Actions for ${user.name}`}
                              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[13px] font-medium leading-none text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]"
                            >
                              •••
                            </button>
                            {isMenuOpen && (
                              <div
                                role="menu"
                                aria-label={`Actions for ${user.name}`}
                                className={`absolute right-0 z-10 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 text-left shadow-lg ${
                                  isLastRow ? "bottom-full mb-1" : "mt-1"
                                }`}
                              >
                                {actions.map((action) => (
                                  <button
                                    key={action.key}
                                    type="button"
                                    role="menuitem"
                                    disabled={action.disabled}
                                    onClick={() => {
                                      setOpenMenuUserId(null);
                                      action.onClick();
                                    }}
                                    className={`block w-full px-3 py-1.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                                      action.destructive
                                        ? "text-[var(--status-flagged)] hover:bg-[var(--status-flagged-bg)]"
                                        : "text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
                                    }`}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {reinviteResult?.userId === user.id && (
                          <p
                            role={reinviteResult.isError ? "alert" : "status"}
                            className={`mt-1 text-[11px] ${
                              reinviteResult.isError
                                ? "text-[var(--status-flagged)]"
                                : "text-[var(--status-active)]"
                            }`}
                          >
                            {reinviteResult.text}
                          </p>
                        )}
                        {changeRoleResult?.userId === user.id && (
                          <p
                            role={changeRoleResult.isError ? "alert" : "status"}
                            className={`mt-1 text-[11px] ${
                              changeRoleResult.isError
                                ? "text-[var(--status-flagged)]"
                                : "text-[var(--status-active)]"
                            }`}
                          >
                            {changeRoleResult.text}
                          </p>
                        )}
                      </td>
                    );
                  })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            className="w-full max-w-[420px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-user-title" className="text-[16px] font-semibold text-[var(--ink)]">
              Delete user
            </h2>
            <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
              Are you sure you want to delete{" "}
              <span className="font-medium text-[var(--ink)]">{pendingDelete.name}</span>? This
              can&rsquo;t be undone.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-md border border-[var(--status-flagged)] bg-[var(--status-flagged-bg)] px-3 py-2 text-[12.5px] text-[var(--status-flagged)]"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-md border border-[var(--border)] px-3.5 py-2 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-sunken)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-md bg-[var(--status-flagged)] px-3.5 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferTarget && (
        <InviteUserModal
          customers={[]}
          lockedCustomer={{
            id: transferTarget.id,
            name: transferTarget.name,
            projects: [],
            address: null,
            city: null,
            state: null,
            zip: null,
            phone: null,
            active: true,
          }}
          canInviteOwner
          customersWithOwner={customersWithOwner}
          autoOpen
          hideTrigger
          initialRole="Customer Owner"
          onClose={() => setTransferTarget(null)}
        />
      )}
    </>
  );
}
