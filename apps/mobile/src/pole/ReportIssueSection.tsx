import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  POLE_ISSUE_TYPES,
  PROBLEM_DETAILS_MAX_LENGTH,
  type PoleIssueType,
} from "@sllights/shared/api-contract";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, radius, space, touch, type } from "@/ui/theme";

/**
 * The issue form, as in the web's Pole Issues modal: "Report an issue for
 * PAS-1", issue type, description, Cancel and Submit issue (disabled until
 * there's a description). Same /api/createpoleissue route as the web.
 */
export function ReportIssueSection({
  poleNumber,
  onCancel,
  onReported,
}: {
  poleNumber: string;
  onCancel: () => void;
  /** Called after a successful submit (the card collapses and the list reloads). */
  onReported: () => void;
}) {
  const { api } = useAuth();
  const [issueType, setIssueType] = useState<PoleIssueType>(POLE_ISSUE_TYPES[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blank = !details.trim();

  async function handleSubmit() {
    if (blank) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPoleIssue({ poleNumber, status: issueType, problemDetails: details.trim() });
      onReported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit the issue.");
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.intro}>
        Report an issue for <Text style={styles.poleNumber}>{poleNumber}</Text>
      </Text>

      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Issue type">
        {POLE_ISSUE_TYPES.map((option) => {
          const selected = option === issueType;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setIssueType(option)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="What's wrong?"
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={PROBLEM_DETAILS_MAX_LENGTH}
      />

      {error ? <Banner tone="error" message={error} /> : null}

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button label="Cancel" variant="secondary" disabled={submitting} onPress={onCancel} />
        </View>
        <View style={styles.action}>
          <Button label="Submit issue" disabled={blank} loading={submitting} onPress={() => void handleSubmit()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  intro: { ...type.small, fontSize: 14 },
  poleNumber: { fontWeight: "700", color: colors.ink },
  segmented: { flexDirection: "row", gap: space.sm },
  segment: {
    flex: 1,
    minHeight: touch.minHeight,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.sm,
    backgroundColor: colors.surface,
  },
  segmentSelected: { borderColor: colors.accentStrong, backgroundColor: colors.accentSoft },
  segmentText: { fontSize: 15, fontWeight: "600", color: colors.inkMuted, textAlign: "center" },
  segmentTextSelected: { color: colors.accentInk },
  actions: { flexDirection: "row", gap: space.sm },
  action: { flex: 1 },
});
