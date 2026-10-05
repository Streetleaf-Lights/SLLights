import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ProjectPoleRow } from "@sllights/shared/api-contract";
import { formatTimestamp } from "@sllights/shared/format";
import { connectedTone, overallStatusTone } from "@sllights/shared/status";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { count, percent } from "@/ui/format";
import { ListRow } from "@/ui/ListRow";
import { QueryStatus } from "@/ui/QueryStatus";
import { SearchField } from "@/ui/SearchField";
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
  onLoaded?: (name: string) => void;
}) {
  const { api } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const data = await api.getProject(customerId, projectId);
    onLoaded?.(data.project.name);
    return data;
  }, [api, customerId, projectId, onLoaded]);
  const { state, retry, refresh } = useApiQuery(load);

  const poles = useMemo(() => {
    if (state.status !== "success") return [];
    const q = query.trim().toUpperCase();
    return q ? state.data.poles.filter((pole) => pole.poleNumber.toUpperCase().includes(q)) : state.data.poles;
  }, [state, query]);

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;
  const { customer, project } = state.data;

  return (
    <FlatList
      data={poles}
      keyExtractor={(pole) => pole.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={15}
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
          <StatRow
            stats={[
              { label: "Total lights", value: count(project.totalLights) },
              viewerScoped
                ? { label: "Lights working", value: percent(project.percentWorking) }
                : { label: "Connected", value: count(project.connectedLights) },
              { label: "Total faults", value: count(project.totalFaults), emphasis: "flagged" },
            ]}
          />
          <SearchField value={query} onChangeText={setQuery} placeholder="Search pole numbers" />
          <Text style={type.small}>
            {poles.length === 1 ? "1 pole" : `${poles.length} poles`}
            {query.trim() ? ` matching “${query.trim()}”` : ""}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={type.small}>
          {query.trim() ? "No poles match that number." : "No poles on file for this project yet."}
        </Text>
      }
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item }) => (
        <PoleRow
          pole={item}
          viewerScoped={viewerScoped}
          onPress={() => router.push({ pathname: "/pole/[poleNumber]", params: { poleNumber: item.poleNumber } })}
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
