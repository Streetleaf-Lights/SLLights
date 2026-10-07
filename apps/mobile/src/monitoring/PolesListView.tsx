import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import type { PoleListRow, PoleListQuery } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { connectedTone, overallStatusTone } from "@sllights/shared/status";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth, useSignedInUser } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { ListRow } from "@/ui/ListRow";
import { Pagination } from "@/ui/Pagination";
import { SearchField } from "@/ui/SearchField";
import { toneColor } from "@/ui/status";
import { colors, space, type } from "@/ui/theme";

const SEARCH_DELAY_MS = 300;

/**
 * The web Poles page: every pole the viewer may see (or, with `faults`,
 * the web's "Total faults" view for one customer or project), searchable
 * by pole number, 10 per page — searched and paged by the server, so the
 * phone never downloads the full list. Rows follow the web's PolesTable
 * columns for the viewer: online dot, 48h Connected (staff only), Overall
 * Status ("48h" for staff), Light, Panel, Battery; plus Project in the
 * faults view.
 */
export function PolesListView({
  faults,
  onOpenPole,
}: {
  faults?: NonNullable<PoleListQuery["faults"]>;
  onOpenPole: (row: PoleListRow) => void;
}) {
  const { api } = useAuth();
  const { claims } = useSignedInUser();
  const viewerScoped = isCustomerScoped(claims.role, claims.customerId);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<PoleListRow>>(null);
  const faultsCustomer = faults?.customerId;
  const faultsProject = faults?.projectId;

  const load = useCallback(
    () =>
      api.listPoles({
        q,
        page,
        ...(faultsCustomer ? { faults: { customerId: faultsCustomer, projectId: faultsProject } } : {}),
      }),
    [api, q, page, faultsCustomer, faultsProject],
  );
  const { state, retry } = useApiQuery(load);

  // Search once typing pauses, from page 1 (as the web resets on a new search).
  useEffect(() => {
    if (input.trim() === q) return;
    const timer = setTimeout(() => {
      setQ(input.trim());
      setPage(1);
      retry();
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, q, retry]);

  const goToPage = (next: number) => {
    setPage(next);
    retry();
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const data = state.status === "success" ? state.data : null;
  const count = data
    ? data.totalPages > 1
      ? `Showing ${data.firstItem}–${data.lastItem} of ${data.totalItems} poles`
      : data.totalItems === 1
        ? "1 pole"
        : `${data.totalItems} poles`
    : null;

  return (
    <FlatList
      ref={listRef}
      data={data?.rows ?? []}
      keyExtractor={(row) => row.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchField value={input} onChangeText={setInput} placeholder="Search by pole number…" />
          {data?.customerName ? <Text style={styles.customer}>Customer: {data.customerName}</Text> : null}
          {count ? <Text style={type.small}>{count}</Text> : null}
          {data ? <Pagination page={data.page} totalPages={data.totalPages} onPageChange={goToPage} /> : null}
        </View>
      }
      ListEmptyComponent={
        state.status === "loading" ? (
          <ActivityIndicator style={styles.loading} accessibilityLabel="Loading poles" color={colors.accentStrong} />
        ) : state.status === "error" ? (
          <View style={styles.error}>
            <Banner tone="error" message={state.message} />
            <Button label="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : (
          <Text style={type.small}>
            {q ? "No poles match your search." : faults ? "No faulted poles right now." : "No poles on file yet."}
          </Text>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item }) => <PoleListItem row={item} viewerScoped={viewerScoped} onPress={() => onOpenPole(item)} />}
    />
  );
}

function PoleListItem({ row, viewerScoped, onPress }: { row: PoleListRow; viewerScoped: boolean; onPress: () => void }) {
  const dot = row.isOnline === null ? colors.inkFaint : row.isOnline ? colors.statusActive : colors.statusFlagged;
  const overall = row.overallStatusText ?? "—";
  return (
    <ListRow
      onPress={onPress}
      accessibilityLabel={[
        `Pole ${row.poleNumber}`,
        row.projectName ? `project ${row.projectName}` : null,
        `${viewerScoped ? "overall status" : "48 hour overall status"} ${overall}`,
        viewerScoped ? null : `connected ${row.connectedText ?? "—"}`,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <View style={styles.top}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.poleNumber}>{row.poleNumber}</Text>
      </View>
      {row.projectName !== undefined ? <Text style={styles.project}>{row.projectName ?? "—"}</Text> : null}
      <View style={styles.facts}>
        {viewerScoped ? null : (
          <Fact label="48h Connected" value={row.connectedText ?? "—"} color={toneColor[connectedTone(row.connectedText)]} />
        )}
        <Fact
          label={viewerScoped ? "Overall Status" : "48h Overall Status"}
          value={overall}
          color={toneColor[overallStatusTone(row.overallStatusText)]}
        />
        <Fact label="Light" value={row.lightStatusText ?? "—"} />
        <Fact label="Panel" value={row.panelText} />
        <Fact label="Battery" value={row.batteryStatusText ?? "—"} />
      </View>
    </ListRow>
  );
}

function Fact({ label, value, color = colors.ink }: { label: string; value: string; color?: string }) {
  return (
    <Text style={styles.fact}>
      <Text style={styles.factLabel}>{label}: </Text>
      <Text style={[styles.factValue, { color }]}>{value}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.sm, marginBottom: space.md },
  customer: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
  loading: { marginTop: space.xl },
  error: { gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  poleNumber: { fontSize: 17, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] },
  project: { fontSize: 13, fontWeight: "600", color: colors.accentStrong },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 2 },
  fact: { fontSize: 13, lineHeight: 19 },
  factLabel: { color: colors.inkFaint },
  factValue: { fontWeight: "600" },
});
