import { StyleSheet, View } from "react-native";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { CustomerListView } from "@/monitoring/CustomerListView";
import { CustomerOverviewView } from "@/monitoring/CustomerOverviewView";
import { Banner } from "@/ui/Banner";
import { colors, space } from "@/ui/theme";

/**
 * The app's home tab. Customer-scoped users see their own customer's
 * overview (the web's /projects page); Streetleaf staff see the customer
 * list (the web's /customers page) and drill in from there.
 */
export default function HomeTab() {
  const { claims } = useSignedInUser();
  const scoped = isCustomerScoped(claims.role, claims.customerId);

  if (!scoped) return <CustomerListView />;
  if (!claims.customerId) {
    return (
      <View style={styles.pad}>
        <Banner tone="warning" message="Your account isn't linked to a customer yet. Contact Streetleaf support." />
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <CustomerOverviewView customerId={claims.customerId} viewerScoped />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg },

});
