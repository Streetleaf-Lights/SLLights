import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { ListRow } from "@/ui/ListRow";
import { QueryStatus } from "@/ui/QueryStatus";
import { SearchField } from "@/ui/SearchField";
import { colors, space, type } from "@/ui/theme";

/** Streetleaf staff: active customers (the web's /customers page), searchable by name. */
export function CustomerListView() {
  const { api } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const load = useCallback(() => api.listCustomers(), [api]);
  const { state, retry, refresh } = useApiQuery(load);

  const customers = useMemo(() => {
    if (state.status !== "success") return [];
    const q = query.trim().toLowerCase();
    return q ? state.data.customers.filter((c) => c.name.toLowerCase().includes(q)) : state.data.customers;
  }, [state, query]);

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;

  return (
    <FlatList
      data={customers}
      keyExtractor={(customer) => customer.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search customers" />
          <Text style={type.small}>
            {customers.length === 1 ? "1 customer" : `${customers.length} customers`}
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={type.small}>No customers match “{query.trim()}”.</Text>}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: customer }) => (
        <ListRow
          accessibilityLabel={customer.name}
          onPress={() => router.push({ pathname: "/customer/[customerId]", params: { customerId: customer.id } })}
        >
          <Text style={styles.name}>{customer.name}</Text>
        </ListRow>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.sm, marginBottom: space.md },
  name: { fontSize: 17, fontWeight: "600", color: colors.ink },
});
