import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { INVITE_EMAIL_PATTERN, inviteRoleOptions, isStreetleafCustomerName, validateNewOwner } from "@sllights/shared/users";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth, useSignedInUser } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { SearchField } from "@/ui/SearchField";
import { TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

type Customer = { id: string; name: string };
const MAX_MATCHES = 8;

/**
 * The web's Invite User form. A Customer Admin/Owner invites into their own
 * customer (shown, not changeable); a Streetleaf Admin picks one with
 * Customer Search, or none for a Streetleaf invite (the "Streetleaf"
 * customer record counts as none). Roles come from the shared rules for
 * that context, the default first, and reset when the customer changes.
 * Choosing Customer Owner for a customer that already has one shows the
 * web's transfer warning. The server enforces the same rules.
 */
export function InviteUserForm({
  customersWithOwner,
  onCancel,
  onSent,
}: {
  /** Customer ids that already have a Customer Owner (from the Users list). */
  customersWithOwner: Set<string>;
  onCancel: () => void;
  onSent: (message: string) => void;
}) {
  const { api } = useAuth();
  const { claims } = useSignedInUser();
  const locked = claims.role !== "Streetleaf Admin";

  // Locked: the viewer's own customer's name. Streetleaf Admin: active customers to search.
  const loadCustomers = useCallback(
    async (): Promise<Customer[]> =>
      locked
        ? [await api.getMyCustomer().then((r) => r.customer ?? { id: claims.customerId ?? "", name: "Your customer" })]
        : (await api.listCustomers()).customers,
    [api, locked, claims.customerId],
  );
  const { state: customersState } = useApiQuery(loadCustomers);
  const customers = useMemo(() => (customersState.status === "success" ? customersState.data : []), [customersState]);

  const [selected, setSelected] = useState<Customer | null>(null);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [touched, setTouched] = useState({ email: false, name: false });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customer = locked ? (customers[0] ?? null) : selected;
  const hasCustomer = locked || (selected !== null && !isStreetleafCustomerName(selected.name));
  const roles = inviteRoleOptions(claims.role, hasCustomer);
  const [roleChoice, setRoleChoice] = useState<string | null>(null);
  // The chosen role, or the context's default when none is chosen (or it no longer applies).
  const role = roleChoice && roles.includes(roleChoice) ? roleChoice : roles[0];

  const choose = (next: Customer | null) => {
    setSelected(next);
    setQuery("");
    setRoleChoice(null); // back to the new context's default, as on the web
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (locked || !q) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, MAX_MATCHES);
  }, [customers, query, locked]);

  const valid = validateNewOwner({ name, email });
  // Checked on its own (not via the combined validator, which reports a
  // missing name first and would hide a bad email until the name is typed).
  const emailError =
    touched.email &&
    (!email.trim() ? "Email is required." : !INVITE_EMAIL_PATTERN.test(email.trim()) ? "Enter a valid email address." : null);
  const nameError = touched.name && !name.trim() ? "Name is required." : null;
  const transferWarning = role === "Customer Owner" && customer !== null && customersWithOwner.has(customer.id);

  async function send() {
    if (!valid.ok || !role) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.inviteUser({
        ...valid.value,
        role,
        ...(!locked && hasCustomer && selected ? { customerId: selected.id } : {}),
      });
      const forCustomer = res.customerName ?? customer?.name ?? null;
      onSent(
        role === "Customer Owner"
          ? `Invitation sent. ${valid.value.name} was invited to become the new Customer Owner${
              forCustomer ? ` for ${forCustomer.trim()}` : ""
            }. Once they accept, the current owner will be removed.`
          : `Invitation sent to ${valid.value.email}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed. Please try again.");
      setSending(false);
    }
  }

  return (
    <View style={styles.form} testID="invite-user-form">
      <Text style={styles.title}>Invite user</Text>

      {locked ? (
        <View>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>{customer?.name ?? "…"}</Text>
        </View>
      ) : selected ? (
        <View style={styles.selected}>
          <Text style={styles.value} numberOfLines={1}>
            Selected: {selected.name.trim()}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Change customer" onPress={() => choose(null)} hitSlop={8}>
            <Text style={styles.link}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gap}>
          <Text style={styles.label}>Customer Search</Text>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search customers…" />
          {query.trim() ? (
            matches.length === 0 ? (
              <Text style={styles.muted}>No matching customers.</Text>
            ) : (
              <View style={styles.matches}>
                {matches.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${c.name.trim()}`}
                    onPress={() => choose(c)}
                    style={({ pressed }) => [styles.match, pressed && styles.pressed]}
                  >
                    <Text style={styles.value}>{c.name.trim()}</Text>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <Text style={styles.muted}>Leave empty to invite Streetleaf staff.</Text>
          )}
        </View>
      )}

      <TextField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setTouched((s) => ({ ...s, email: true }));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setTouched((s) => ({ ...s, name: true }));
        }}
        autoCapitalize="words"
        textContentType="name"
      />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

      <Text style={styles.label}>Role</Text>
      <View style={styles.roles} accessibilityRole="radiogroup" accessibilityLabel="Role">
        {roles.map((option) => {
          const isSelected = option === role;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={option}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setRoleChoice(option)}
              style={[styles.role, isSelected && styles.roleSelected]}
            >
              <Text style={[styles.roleText, isSelected && styles.roleTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {transferWarning ? (
        <Banner tone="warning" message="This transfers ownership — once accepted, the current Customer Owner is removed." />
      ) : null}

      {error ? <Banner tone="error" message={error} /> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="secondary" disabled={sending} onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label="Send invite" disabled={!valid.ok || !role} loading={sending} onPress={() => void send()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  label: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  value: { fontSize: 15, color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  link: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
  gap: { gap: space.xs },
  selected: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  matches: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  match: { paddingHorizontal: space.md, paddingVertical: space.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.surfaceSunken },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  role: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  roleSelected: { borderColor: colors.accentStrong, backgroundColor: colors.accentSoft },
  roleText: { fontSize: 14, fontWeight: "600", color: colors.inkMuted },
  roleTextSelected: { color: colors.accentInk },
  row: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
