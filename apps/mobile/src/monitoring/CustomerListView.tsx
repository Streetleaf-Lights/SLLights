import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { paginate } from "@sllights/shared/pagination";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { ListRow } from "@/ui/ListRow";
import { Pagination } from "@/ui/Pagination";
import { QueryStatus } from "@/ui/QueryStatus";
import { SearchField } from "@/ui/SearchField";
import { colors, space, type } from "@/ui/theme";

/** Streetleaf staff: active customers (the web's /customers page), searchable by name. */
export function CustomerListView() {
  const { api } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<{ id: string; name: string }>>(null);
  const load = useCallback(() => api.listCustomers(), [api]);
  const { state, retry, refresh } = useApiQuery(load);

  const customers = useMemo(() => {
    if (state.status !== "success") return [];
    const q = query.trim().toLowerCase();
    return q ? state.data.customers.filter((c) => c.name.toLowerCase().includes(q)) : state.data.customers;
  }, [state, query]);

  // 10 per page, like the web's customer table.
  const current = paginate(customers, page);

  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  // A new search starts from page 1, as on the web.
  const search = (text: string) => {
    setQuery(text);
    setPage(1);
  };

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;

  return (
    <FlatList
      ref={listRef}
      data={current.items}
      keyExtractor={(customer) => customer.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchField value={query} onChangeText={search} placeholder="Search customers" />
          <Text style={type.small}>
            {current.totalPages > 1
              ? `Showing ${current.firstItem}–${current.lastItem} of ${current.totalItems} customers`
              : current.totalItems === 1
                ? "1 customer"
                : `${current.totalItems} customers`}
          </Text>
          <Pagination page={current.page} totalPages={current.totalPages} onPageChange={goToPage} />
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
