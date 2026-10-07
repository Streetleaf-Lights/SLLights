import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { UserRow } from "@sllights/shared/api-contract";
import { paginate } from "@sllights/shared/pagination";
import type { UserStatus } from "@sllights/shared/users";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { Pagination } from "@/ui/Pagination";
import { QueryStatus } from "@/ui/QueryStatus";
import { SearchField } from "@/ui/SearchField";
import { colors, radius, space, type } from "@/ui/theme";
import { TransferOwnershipForm } from "./TransferOwnershipForm";

type RowResult = { tone: "ok" | "error"; message: string };

/**
 * The web Users page: everyone a Streetleaf staff member can see, or a
 * customer's own people — Name, Email, Role, Status (and Customer for
 * staff), 10 per page, searchable. Each row offers only the actions the
 * server says this viewer has on that user (Re-invite, Change Role,
 * Delete — the server enforces the same rules). Delete asks first.
 */
export function UsersListView() {
  const { api } = useAuth();
  const load = useCallback(() => api.listUsers(), [api]);
  const { state, retry, refresh } = useApiQuery(load);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RowResult>>({});
  // The Owner row whose Transfer Ownership form is open, if any.
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const listRef = useRef<FlatList<UserRow>>(null);

  const users = useMemo(() => {
    if (state.status !== "success") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.data.users;
    return state.data.users.filter((u) =>
      [u.name, u.email, u.customerName ?? ""].some((field) => field.toLowerCase().includes(q)),
    );
  }, [state, query]);
  const current = paginate(users, page);

  const run = async (user: UserRow, key: string, action: () => Promise<string>, refreshAfter: boolean) => {
    setBusy(`${user.id}:${key}`);
    try {
      const message = await action();
      setResults((r) => ({ ...r, [user.id]: { tone: "ok", message } }));
      if (refreshAfter) refresh();
    } catch (err) {
      setResults((r) => ({ ...r, [user.id]: { tone: "error", message: err instanceof Error ? err.message : "Something went wrong." } }));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = (user: UserRow) =>
    Alert.alert("Delete user?", `${user.name} (${user.email}) will lose access. This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void run(user, "delete", async () => {
            await api.deleteUser(user.id);
            return `${user.name} was deleted.`;
          }, true),
      },
    ]);

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;

  return (
    <FlatList
      ref={listRef}
      data={current.items}
      keyExtractor={(u) => u.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchField
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setPage(1);
            }}
            placeholder="Search users…"
          />
          <Text style={type.small}>
            {current.totalPages > 1
              ? `Showing ${current.firstItem}–${current.lastItem} of ${current.totalItems} users`
              : current.totalItems === 1
                ? "1 user"
                : `${current.totalItems} users`}
          </Text>
          <Pagination
            page={current.page}
            totalPages={current.totalPages}
            onPageChange={(next) => {
              setPage(next);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
          />
        </View>
      }
      ListEmptyComponent={<Text style={type.small}>{query.trim() ? "No users match your search." : "No users yet."}</Text>}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: user }) => {
        const result = results[user.id];
        const isBusy = (key: string) => busy === `${user.id}:${key}`;
        const anyAction =
          user.actions.reinvite || user.actions.changeRole || user.actions.delete || user.actions.transferOwnership;
        return (
          <View style={styles.card} accessibilityLabel={`${user.name}, ${user.roleLabel}, ${user.status}`}>
            <View style={styles.top}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              <StatusBadge status={user.status} />
            </View>
            <Text style={styles.email} numberOfLines={1} selectable>
              {user.email}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.role}>{user.roleLabel}</Text>
              {user.customerName !== undefined ? (
                <Text style={type.small} numberOfLines={1}>
                  {user.customerName ?? "Streetleaf"}
                </Text>
              ) : null}
            </View>
            {anyAction ? (
              <View style={styles.actions}>
                {user.actions.reinvite ? (
                  <Action
                    label={isBusy("reinvite") ? "Sending…" : "Re-invite"}
                    disabled={busy !== null}
                    onPress={() =>
                      void run(user, "reinvite", async () => {
                        await api.reinviteUser(user.id);
                        return `Invite re-sent to ${user.email}.`;
                      }, false)
                    }
                  />
                ) : null}
                {user.actions.changeRole ? (
                  <Action
                    label={isBusy("role") ? "Changing…" : "Change Role"}
                    disabled={busy !== null}
                    onPress={() =>
                      void run(user, "role", async () => `Role changed to ${(await api.changeUserRole(user.id)).roleLabel}.`, true)
                    }
                  />
                ) : null}
                {user.actions.transferOwnership ? (
                  <Action
                    label="Transfer Ownership"
                    disabled={busy !== null || transferFor === user.id}
                    onPress={() => {
                      setResults((r) => {
                        const next = { ...r };
                        delete next[user.id]; // clear this row's previous message
                        return next;
                      });
                      setTransferFor(user.id);
                    }}
                  />
                ) : null}
                {user.actions.delete ? (
                  <Action
                    label={isBusy("delete") ? "Deleting…" : "Delete"}
                    destructive
                    disabled={busy !== null}
                    onPress={() => confirmDelete(user)}
                  />
                ) : null}
              </View>
            ) : null}
            {transferFor === user.id ? (
              <TransferOwnershipForm
                ownerId={user.id}
                customerName={user.customerName}
                onCancel={() => setTransferFor(null)}
                onSent={(message) => {
                  setTransferFor(null);
                  setResults((r) => ({ ...r, [user.id]: { tone: "ok", message } }));
                  refresh(); // the invited owner appears as Pending
                }}
              />
            ) : null}
            {result ? (
              <Text
                accessibilityRole={result.tone === "error" ? "alert" : "text"}
                style={[styles.result, { color: result.tone === "error" ? colors.statusFlagged : colors.statusActive }]}
              >
                {result.message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const BADGE: Record<UserStatus, { text: string; fg: string; bg: string }> = {
  active: { text: "Active", fg: colors.statusActive, bg: colors.statusActiveBg },
  pending: { text: "Pending", fg: colors.statusWarning, bg: colors.statusWarningBg },
  inactive: { text: "Inactive", fg: colors.inkMuted, bg: colors.surfaceSunken },
};

function StatusBadge({ status }: { status: UserStatus }) {
  const b = BADGE[status];
  return (
    <View style={[styles.badge, { backgroundColor: b.bg }]}>
      <Text style={[styles.badgeText, { color: b.fg }]}>{b.text}</Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  disabled,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.action, destructive && styles.actionDestructive, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.actionText, destructive && styles.actionTextDestructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.sm, marginBottom: space.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: 4,
  },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.ink },
  email: { fontSize: 14, color: colors.inkMuted },
  meta: { flexDirection: "row", alignItems: "center", gap: space.md, flexWrap: "wrap" },
  role: { fontSize: 13, fontWeight: "600", color: colors.accentStrong },
  badge: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  action: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  actionDestructive: { borderColor: colors.statusFlaggedBg, backgroundColor: colors.statusFlaggedBg },
  actionText: { fontSize: 13.5, fontWeight: "600", color: colors.ink },
  actionTextDestructive: { color: colors.statusFlagged },
  dim: { opacity: 0.55 },
  result: { fontSize: 13, marginTop: 2 },
});
