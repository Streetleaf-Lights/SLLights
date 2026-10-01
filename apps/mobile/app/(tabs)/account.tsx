import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useAuth, useSignedInUser } from "@/auth/AuthProvider";
import { Button } from "@/ui/Button";
import { colors, radius, space, type } from "@/ui/theme";

export default function AccountScreen() {
  const { signOut } = useAuth();
  const { user, claims } = useSignedInUser();
  const [signingOut, setSigningOut] = useState(false);
  const scope = isCustomerScoped(claims.role, claims.customerId) ? "Your customer's poles" : "All customers";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Row label="Name" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value={claims.role} />
        <Row label="Can see" value={scope} />
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
