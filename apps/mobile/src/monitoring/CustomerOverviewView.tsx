import { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { CustomerOverviewResponse } from "@sllights/shared/api-contract";
import { initials } from "@sllights/shared/format";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { count, percent } from "@/ui/format";
import { ListRow } from "@/ui/ListRow";
import { QueryStatus } from "@/ui/QueryStatus";
import { StatRow, type Stat } from "@/ui/StatRow";
import { colors, radius, space, type } from "@/ui/theme";

type Project = CustomerOverviewResponse["projects"][number];

/**
 * The mobile CustomerOverview: customer header, summary stats, project
 * list. Used as the Projects tab (a customer viewing their own) and the
 * customer screen (staff browsing any customer).
 *
 * `viewerScoped` follows the web rule: customer-scoped viewers don't see
 * "Connected lights" on project rows.
 */
export function CustomerOverviewView({
  customerId,
  viewerScoped,
}: {
  customerId: string;
  viewerScoped: boolean;
}) {
  const { api } = useAuth();
  const router = useRouter();
  const load = useCallback(() => api.getCustomerOverview(customerId), [api, customerId]);
  const { state, retry, refresh } = useApiQuery(load);

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;
  const { customer, summary, projects } = state.data;

  const projectStats = (project: Project): Stat[] => [
    { label: "Lights", value: count(project.totalLights) },
    ...(viewerScoped ? [] : [{ label: "Connected", value: count(project.connectedLights) }]),
    { label: "Faults", value: count(project.totalFaults), emphasis: "flagged" as const },
  ];

  return (
    <FlatList
      data={projects}
      keyExtractor={(project) => project.id}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(customer.name)}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={type.heading} accessibilityRole="header">
                {customer.name}
                {customer.active ? "" : "  · Inactive"}
              </Text>
              {customer.addressLine ? <Text style={type.small}>{customer.addressLine}</Text> : null}
              {customer.phone ? <Text style={type.small}>{customer.phone}</Text> : null}
            </View>
          </View>

          <Text style={styles.section}>Summary</Text>
          <StatRow
            stats={[
              { label: "Total lights", value: count(summary.totalLights) },
              { label: "Lights working", value: percent(summary.percentWorking) },
              {
                label: "Total faults",
                value: count(summary.totalFaults),
                emphasis: "flagged",
                // As on the web: a link to the faulted poles, only when there are some.
                onPress:
                  (summary.totalFaults ?? 0) > 0
                    ? () => router.push({ pathname: "/faults", params: { customerId: customer.id } })
                    : undefined,
              },
            ]}
          />

          <Text style={styles.section}>
            {projects.length === 1 ? "1 project" : `${projects.length} projects`}
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={type.small}>No projects on file for this customer yet.</Text>}
      ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      renderItem={({ item: project }) => (
        <ListRow
          accessibilityLabel={`${project.name}, ${count(project.totalLights)} lights, ${count(project.totalFaults)} faults`}
          onPress={() =>
            router.push({
              pathname: "/project/[customerId]/[projectId]",
              params: { customerId: customer.id, projectId: project.id },
            })
          }
        >
          <Text style={styles.projectName} numberOfLines={2}>
            {project.name}
            {project.active ? "" : "  · Inactive"}
          </Text>
          <StatRow compact stats={projectStats(project)} />
        </ListRow>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  header: { gap: space.md, marginBottom: space.md },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 19, fontWeight: "600", color: colors.accentStrong },
  identityText: { flex: 1, gap: 2 },
  section: {
    marginTop: space.sm,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  projectName: { fontSize: 17, fontWeight: "600", color: colors.ink },
});
