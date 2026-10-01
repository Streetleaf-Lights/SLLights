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

/** Same submission the web's PoleIssuesLink makes, through the same /api/createpoleissue route. */
export function ReportIssueSection({ poleNumber }: { poleNumber: string }) {
  const { api } = useAuth();
  const [issueType, setIssueType] = useState<PoleIssueType>(POLE_ISSUE_TYPES[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function handleSubmit() {
    if (!details.trim()) {
      setResult({ tone: "error", message: "Describe the problem before reporting it." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      await api.createPoleIssue({ poleNumber, status: issueType, problemDetails: details.trim() });
      setDetails("");
      setResult({ tone: "success", message: "Issue reported." });
    } catch (err) {
      setResult({ tone: "error", message: err instanceof Error ? err.message : "Couldn't report the issue." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text style={type.heading}>Report an issue</Text>
      <View style={styles.segmented} accessibilityRole="radiogroup">
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
      {result ? <Banner tone={result.tone} message={result.message} /> : null}
      <Button label="Report issue" variant="secondary" loading={submitting} onPress={() => void handleSubmit()} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
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
});
