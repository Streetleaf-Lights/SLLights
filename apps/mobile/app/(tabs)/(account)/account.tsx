import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth, useSignedInUser } from "@/auth/AuthProvider";
import { TestingTools } from "@/installs/TestingTools";
import { useDeleteMyAccount } from "@/account/useDeleteMyAccount";
import { openLegalPage, privacyPolicyUrl } from "@/legal/legalLinks";
import { ListRow } from "@/ui/ListRow";
import { Button } from "@/ui/Button";
import { colors, radius, space, type } from "@/ui/theme";

/** null = still loading. */
type CustomerLabel = string | null;

export default function AccountScreen() {
  const { confirmDeleteMyAccount, deleting } = useDeleteMyAccount();
  const { api, signOut } = useAuth();
  const router = useRouter();
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
      {/* The web's Users page lives here on mobile. */}
      <ListRow accessibilityLabel="Users" onPress={() => router.push("/users")}>
        <Text style={styles.link}>Users</Text>
        <Text style={type.small}>People with access to the dashboard</Text>
      </ListRow>
      {/* Apple asks for the privacy policy, and a way to start account deletion, inside the app. */}
      <ListRow accessibilityLabel="Privacy policy" onPress={() => void openLegalPage(privacyPolicyUrl(), "Privacy policy")}>
        <Text style={styles.link}>Privacy policy</Text>
        <Text style={type.small}>How Streetleaf handles your information</Text>
      </ListRow>
      <ListRow accessibilityLabel="Delete your account" onPress={confirmDeleteMyAccount}>
        <Text style={[styles.link, styles.destructive]}>{deleting ? "Deleting your account…" : "Delete your account"}</Text>
        <Text style={type.small}>Permanently delete your account and sign-in</Text>
      </ListRow>
      <TestingTools />
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
  link: { fontSize: 17, fontWeight: "600", color: colors.ink },
  destructive: { color: colors.statusFlagged },
});
