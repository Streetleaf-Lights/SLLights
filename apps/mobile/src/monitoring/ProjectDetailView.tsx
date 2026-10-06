import { useCallback, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ProjectDetailResponse, ProjectPoleRow } from "@sllights/shared/api-contract";
import { formatTimestamp } from "@sllights/shared/format";
import { paginate } from "@sllights/shared/pagination";
import { connectedTone, overallStatusTone } from "@sllights/shared/status";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { count } from "@/ui/format";
import { ListRow } from "@/ui/ListRow";
import { Pagination } from "@/ui/Pagination";
import { QueryStatus } from "@/ui/QueryStatus";
import { StatRow } from "@/ui/StatRow";
import { toneColor } from "@/ui/status";
import { colors, radius, space, type } from "@/ui/theme";

/**
 * Project stats and its poles — the web's project page. Following the web
 * rules for customer-scoped viewers: no "Connected" stat or column, and
 * "Overall status" without the 48h prefix.
 */
export function ProjectDetailView({
  customerId,
  projectId,
  viewerScoped,
  onLoaded,
}: {
  customerId: string;
  projectId: string;
  viewerScoped: boolean;
  /** Called with each successful load (the screen uses the customer name for its back button). */
  onLoaded?: (data: ProjectDetailResponse) => void;
}) {
  const { api } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<ProjectPoleRow>>(null);
  const load = useCallback(async () => {
    const data = await api.getProject(customerId, projectId);
    onLoaded?.(data);
    return data;
  }, [api, customerId, projectId, onLoaded]);
  const { state, retry, refresh } = useApiQuery(load);

  // 10 poles per page, paged the same way as the customer list.
  const current = paginate(state.status === "success" ? state.data.poles : [], page);

  const goToPage = (next: number) => {
    setPage(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;
  const { customer, project } = state.data;

  return (
    <FlatList
      ref={listRef}
      data={current.items}
      keyExtractor={(pole) => pole.id}
      contentContainerStyle={styles.content}
      initialNumToRender={10}
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.customer}>{customer.name}</Text>
            <Text style={type.title} accessibilityRole="header">
              {project.name}
            </Text>
            {project.active ? null : <Text style={type.small}>Inactive project</Text>}
          </View>
          {/* Customer-scoped viewers get Total lights and Total faults only (no Connected, as on the web). */}
          <StatRow
            stats={[
              { label: "Total lights", value: count(project.totalLights) },
              ...(viewerScoped ? [] : [{ label: "Connected", value: count(project.connectedLights) }]),
              { label: "Total faults", value: count(project.totalFaults), emphasis: "flagged" as const },
            ]}
          />
          <Text style={type.small}>
            {current.totalPages > 1
              ? `Showing ${current.firstItem}–${current.lastItem} of ${current.totalItems} poles`
              : current.totalItems === 1
                ? "1 pole"
                : `${current.totalItems} poles`}
          </Text>
          <Pagination page={current.page} totalPages={current.totalPages} onPageChange={goToPage} />
        </View>
      }
      ListEmptyComponent={<Text style={type.small}>No poles on file for this project yet.</Text>}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item }) => (
        <PoleRow
          pole={item}
          viewerScoped={viewerScoped}
          onPress={() => router.push({ pathname: "/(tabs)/(home)/pole/[poleNumber]", params: { poleNumber: item.poleNumber } })}
        />
      )}
    />
  );
}

function PoleRow({
  pole,
  viewerScoped,
  onPress,
}: {
  pole: ProjectPoleRow;
  viewerScoped: boolean;
  onPress: () => void;
}) {
  const status = pole.overallStatusText ?? "—";
  const connected = pole.connectedText ?? "—";
  const issues = pole.openIssues === 1 ? "1 open issue" : `${pole.openIssues} open issues`;
  return (
    <ListRow
      onPress={onPress}
      accessibilityLabel={[
        `Pole ${pole.poleNumber}`,
        `${viewerScoped ? "Overall status" : "48 hour overall status"} ${status}`,
        viewerScoped ? null : `Connected ${connected}`,
        pole.openIssues > 0 ? issues : null,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <View style={styles.poleTop}>
        <Text style={styles.poleNumber}>{pole.poleNumber}</Text>
        {pole.openIssues > 0 ? (
          <View style={styles.issueBadge}>
            <Text style={styles.issueBadgeText}>{issues}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.poleMeta}>
        <Text style={type.small}>
          {viewerScoped ? "Status " : "48h status "}
          <Text style={[styles.metaValue, { color: toneColor[overallStatusTone(pole.overallStatusText)] }]}>{status}</Text>
        </Text>
        {viewerScoped ? null : (
          <Text style={type.small}>
            {"48h connected "}
            <Text style={[styles.metaValue, { color: toneColor[connectedTone(pole.connectedText)] }]}>{connected}</Text>
          </Text>
        )}
      </View>
      {pole.lastUpdate ? <Text style={type.small}>Updated {formatTimestamp(pole.lastUpdate)}</Text> : null}
    </ListRow>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.md },
  titleBlock: { gap: 2 },
  customer: { fontSize: 14, fontWeight: "600", color: colors.accentStrong },
  poleTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  poleNumber: { fontSize: 18, fontWeight: "700", letterSpacing: 0.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  issueBadge: {
    backgroundColor: colors.statusFlaggedBg,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  issueBadgeText: { fontSize: 12, fontWeight: "600", color: colors.statusFlagged },
  poleMeta: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: 2 },
  metaValue: { fontWeight: "600" },
});
