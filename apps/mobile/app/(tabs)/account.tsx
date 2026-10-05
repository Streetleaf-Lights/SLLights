import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth, useSignedInUser } from "@/auth/AuthProvider";
import { Button } from "@/ui/Button";
import { colors, radius, space, type } from "@/ui/theme";

/** null = still loading. */
type CustomerLabel = string | null;

export default function AccountScreen() {
  const { api, signOut } = useAuth();
  const { user, claims } = useSignedInUser();
  const [signingOut, setSigningOut] = useState(false);
  const [customer, setCustomer] = useState<CustomerLabel>(claims.customerId ? null : "Streetleaf");

  useEffect(() => {
    // Streetleaf staff don't belong to a customer: nothing to fetch.
    if (!claims.customerId) return;
    let cancelled = false;
    api
      .getMyCustomer()
      .then(({ customer: result }) => !cancelled && setCustomer(result?.name ?? "—"))
      .catch(() => !cancelled && setCustomer("Couldn't load"));
    return () => {
      cancelled = true;
    };
  }, [api, claims.customerId]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value={claims.role} />
        <Row label="Customer" value={customer ?? "Loading…"} />
      </View>
      <Button
        label="Sign out"
        variant="secondary"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true);
          void signOut();
        }}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={type.small}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  row: { gap: 2 },
});
