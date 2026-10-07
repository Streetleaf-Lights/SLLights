import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { INVITE_EMAIL_PATTERN, validateNewOwner } from "@sllights/shared/users";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space } from "@/ui/theme";

/**
 * The web's Transfer Ownership: invite a new Customer Owner for this
 * Owner's customer. Only the new owner's name and email are sent — the
 * server takes the customer from the current Owner's record and always
 * uses the Customer Owner role. Send stays disabled until both are valid
 * (the web invite form's rules).
 */
export function TransferOwnershipForm({
  ownerId,
  customerName,
  onCancel,
  onSent,
}: {
  ownerId: string;
  /** Known for Streetleaf staff (the row's customer); the server confirms it either way. */
  customerName: string | null | undefined;
  onCancel: () => void;
  onSent: (message: string) => void;
}) {
  const { api } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = validateNewOwner({ name, email });

  async function send() {
    if (!valid.ok) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.transferOwnership(ownerId, valid.value);
      const customer = res.customerName ?? customerName;
      onSent(
        `Invitation sent. ${valid.value.name} was invited to become the new Customer Owner${
          customer ? ` for ${customer}` : ""
        }. Once they accept, the current owner will be removed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed. Please try again.");
      setSending(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Transfer Ownership</Text>
      <Text style={styles.muted}>
        Invite the new Customer Owner{customerName ? ` for ${customerName}` : ""}.
      </Text>
      <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      {/* Checked on its own, so a bad email shows even before the name is typed. */}
      {email.trim() !== "" && !INVITE_EMAIL_PATTERN.test(email.trim()) ? (
        <Text style={styles.error}>Enter a valid email address.</Text>
      ) : null}
      <Banner tone="warning" message="This transfers ownership — once accepted, the current Customer Owner is removed." />
      {error ? <Banner tone="error" message={error} /> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="secondary" disabled={sending} onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label="Send invite" disabled={!valid.ok} loading={sending} onPress={() => void send()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.sm,
    marginTop: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted },
  error: { fontSize: 13, color: colors.statusFlagged },
  row: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
