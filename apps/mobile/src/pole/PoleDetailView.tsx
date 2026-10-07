import { useCallback, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PoleDetailResponse } from "@sllights/shared/api-contract";
import { formatDate, formatTimestamp } from "@sllights/shared/format";
import {
  formatCoordinate,
  issueStatusTone,
  sortIssuesNewestFirst,
  type PoleStatusCard,
} from "@sllights/shared/pole-detail";
import { overallStatusTone } from "@sllights/shared/status";
import { useApiQuery } from "@/api/useApiQuery";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { QueryStatus } from "@/ui/QueryStatus";
import { toneColor } from "@/ui/status";
import { colors, radius, space, touch, type } from "@/ui/theme";
import { ReportIssueSection } from "./ReportIssueSection";
import { PoleLocationMap } from "./PoleLocationMap";
import { VitalsChart } from "./VitalsChart";

/**
 * The web pole page on mobile: header (project, pole number, last update,
 * install date, coordinates, connection, and the 48H overall status for
 * staff), then the Light / Panel / Battery / Issue Entry status cards. The
 * server shapes the cards for the viewer's role with the same shared rules
 * the web page uses — then the Vitals History chart and the Location map.
 * Remote control comes later.
 */
export function PoleDetailView({
  customerId,
  projectId,
  poleId,
  onLoaded,
  footer,
}: {
  customerId: string;
  projectId: string;
  poleId: string;
  onLoaded?: (data: PoleDetailResponse) => void;
  /** Extra content under the cards (the Scan tab adds install recording). */
  footer?: ReactNode;
}) {
  const { api } = useAuth();
  const load = useCallback(async () => {
    const data = await api.getPoleDetail(customerId, projectId, poleId);
    onLoaded?.(data);
    return data;
  }, [api, customerId, projectId, poleId, onLoaded]);
  const { state, retry, refresh } = useApiQuery(load);

  if (state.status !== "success") return <QueryStatus state={state} onRetry={retry} />;
  const { project, pole } = state.data;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={refresh} tintColor={colors.accentStrong} />}
    >
      <View style={styles.header}>
        <Text style={styles.project}>
          {project.name}
          {project.active ? "" : "  · Inactive"}
        </Text>
        <Text style={styles.poleNumber} accessibilityRole="header">
          {pole.poleNumber}
          {pole.active ? "" : "  · Inactive"}
        </Text>

        <View style={styles.connectionRow}>
          <View style={[styles.dot, { backgroundColor: toneColor[pole.connection.tone] }]} />
          <Text style={[styles.connection, { color: toneColor[pole.connection.tone] }]}>{pole.connection.text}</Text>
        </View>
        {pole.overallStatusText !== undefined ? (
          <Fact
            label="48H Overall Status"
            value={pole.overallStatusText ?? "—"}
            color={toneColor[overallStatusTone(pole.overallStatusText)]}
            strong={pole.overallStatusText === "Fault"}
          />
        ) : null}

        {/* Two columns, as the web groups them: dates on the left, coordinates on the right. */}
        <View style={styles.factColumns}>
          <View style={styles.factColumn} testID="pole-dates">
            {/* Date only — the time doesn't fit beside the coordinates on a phone. */}
            <Fact label="Last Update" value={formatDate(pole.lastUpdate)} />
            <Fact label="Install Date" value={pole.installDate ?? "—"} />
          </View>
          <View style={styles.factColumn} testID="pole-coordinates">
            <Fact label="Lat" value={formatCoordinate(pole.lat)} />
            <Fact label="Long" value={formatCoordinate(pole.long)} />
          </View>
        </View>
      </View>

      <Text style={styles.section}>Statuses</Text>
      {pole.cards.map((card) => (
        <StatusCard key={card.id} card={card}>
          {card.id === "issues" ? (
            <IssueEntry poleNumber={pole.poleNumber} issues={pole.issues} onReported={refresh} />
          ) : null}
        </StatusCard>
      ))}

      {/* After Statuses, as on the web. */}
      <Text style={styles.section}>Vitals History</Text>
      <VitalsChart customerId={state.data.customer.id} projectId={project.id} poleId={pole.id} />

      {/* Last, as on the web. */}
      <Text style={styles.section}>Location</Text>
      <PoleLocationMap lat={pole.lat} long={pole.long} poleNumber={pole.poleNumber} />

      {footer}
    </ScrollView>
  );
}

function Fact({ label, value, color = colors.inkMuted, strong = false }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <Text style={styles.fact}>
      <Text style={styles.factLabel}>{label}: </Text>
      <Text style={[{ color }, strong && styles.strong]}>{value}</Text>
    </Text>
  );
}

function StatusCard({ card, children }: { card: PoleStatusCard; children?: ReactNode }) {
  return (
    <View style={styles.card} accessibilityLabel={`${card.title}: ${card.status.text}`}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={[styles.cardStatus, { color: toneColor[card.status.tone] }]}>{card.status.text}</Text>
      </View>
      {card.metrics.map((metric) => (
        <View key={metric.label}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
          </View>
          {metric.note ? <Text style={styles.metricNote}>{metric.note}</Text> : null}
        </View>
      ))}
      {children}
    </View>
  );
}

/**
 * The Issue Entry card's contents, following the web: collapsed to a link —
 * "View or Report Issue" when the pole has issues, "Report Issue" when it
 * doesn't — which expands the form (on top) and the issue list (below).
 * Cancel collapses it again; so does a successful submit, which then
 * reloads the page so the list and the card's status are current.
 */
function IssueEntry({
  poleNumber,
  issues,
  onReported,
}: {
  poleNumber: string;
  issues: PoleDetailResponse["pole"]["issues"];
  onReported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);

  if (!open) {
    return (
      <View style={styles.issueEntry}>
        {reported ? <Banner tone="success" message="Issue reported." /> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setReported(false);
            setOpen(true);
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkText}>{issues.length > 0 ? "View or Report Issue" : "Report Issue"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.issueEntry}>
      <ReportIssueSection
        poleNumber={poleNumber}
        onCancel={() => setOpen(false)}
        onReported={() => {
          setOpen(false);
          setReported(true);
          onReported();
        }}
      />
      <IssueList issues={issues} />
    </View>
  );
}

function IssueList({ issues }: { issues: PoleDetailResponse["pole"]["issues"] }) {
  if (issues.length === 0) return <Text style={type.small}>No issues reported for this pole.</Text>;
  return (
    <View style={styles.issues}>
      {sortIssuesNewestFirst(issues).map((issue) => (
        <View key={issue.issueId} style={styles.issue}>
          <View style={styles.cardTop}>
            <Text style={styles.issueId}>{issue.issueId}</Text>
            <Text style={[styles.issueStatus, { color: toneColor[issueStatusTone(issue.status)] }]}>{issue.status}</Text>
          </View>
          {issue.problemDetails ? <Text style={styles.issueDetails}>{issue.problemDetails}</Text> : null}
          <Text style={type.small}>Reported {formatTimestamp(issue.dateReported)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl * 2 },
  header: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  project: { fontSize: 14, fontWeight: "600", color: colors.accent },
  poleNumber: { fontSize: 24, fontWeight: "700", letterSpacing: 0.5, color: colors.ink, fontVariant: ["tabular-nums"] },
  connectionRow: { flexDirection: "row", alignItems: "center", gap: space.xs + 2, marginTop: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connection: { fontSize: 15, fontWeight: "700" },
  factColumns: { flexDirection: "row", gap: space.md, marginTop: space.xs },
  factColumn: { flex: 1, gap: 2 },
  fact: { fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  factLabel: { color: colors.inkFaint },
  strong: { fontWeight: "700" },
  section: {
    marginTop: space.sm,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.inkMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  cardStatus: { fontSize: 15, fontWeight: "700" },
  metricRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  metricLabel: { flexShrink: 1, fontSize: 14, color: colors.inkFaint },
  metricValue: { fontSize: 14, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  metricNote: { fontSize: 13, color: colors.inkMuted, textAlign: "right" },
  issues: { gap: space.sm },
  issueEntry: { gap: space.md },
  link: { minHeight: touch.minHeight - 12, justifyContent: "center", alignSelf: "flex-start" },
  linkPressed: { opacity: 0.5 },
  linkText: { fontSize: 15, fontWeight: "600", color: colors.accentStrong },
  issue: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, gap: 2 },
  issueId: { fontSize: 13, color: colors.inkMuted, fontVariant: ["tabular-nums"] },
  issueStatus: { fontSize: 13, fontWeight: "600" },
  issueDetails: { fontSize: 15, lineHeight: 21, color: colors.ink },
});
