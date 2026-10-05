import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { isStreetleafStaff } from "@sllights/shared/auth-role";
import type { PoleSummary } from "@sllights/shared/types";
import { useAuth } from "@/auth/AuthProvider";
import { InstallSection } from "@/pole/InstallSection";
import { PoleSummaryCard } from "@/pole/PoleSummaryCard";
import { ReportIssueSection } from "@/pole/ReportIssueSection";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { colors, space } from "@/ui/theme";

type Lookup =
  | { status: "loading" }
  | { status: "done"; pole: PoleSummary | null }
  | { status: "error"; message: string };

export default function PoleScreen() {
  const params = useLocalSearchParams<{ poleNumber: string; scanned?: string }>();
  const poleNumber = String(params.poleNumber ?? "").toUpperCase();
  const scannedValue = typeof params.scanned === "string" ? params.scanned : null;
  const { api, state: auth } = useAuth();
  // Recording installs is field work for Streetleaf staff (the server enforces this too).
  const canRecordInstall =
    auth.status === "signedIn" && isStreetleafStaff(auth.claims.role, auth.claims.customerId);
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .lookupPole(poleNumber)
      .then(({ pole }) => !cancelled && setLookup({ status: "done", pole }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setLookup({ status: "error", message: err instanceof Error ? err.message : "Pole lookup failed." }),
      );
    return () => {
      cancelled = true;
    };
  }, [api, poleNumber, attempt]);

  function retry() {
    setLookup({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  const pole = lookup.status === "done" ? lookup.pole : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: poleNumber }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PoleSummaryCard poleNumber={poleNumber} pole={pole} />

        {lookup.status === "loading" ? (
          <ActivityIndicator accessibilityLabel="Looking up pole" color={colors.accentStrong} />
        ) : null}
        {lookup.status === "error" ? (
          <View style={styles.gap}>
            <Banner tone="error" message={lookup.message} />
            <Button label="Try again" variant="secondary" onPress={retry} />
          </View>
        ) : null}
        {lookup.status === "done" && !pole ? (
          <Banner
            tone="warning"
            message={
              canRecordInstall
                ? "No pole with this number is on your account yet. If it's a new pole, you can still record the install. Otherwise, check the tag and scan again."
                : "No pole with this number is on your account."
            }
          />
        ) : null}

        {/* Install recording works even when lookup fails (e.g. weak signal): the pole number and GPS are what matter. */}
        {lookup.status !== "loading" && canRecordInstall ? <InstallSection poleNumber={poleNumber} scannedValue={scannedValue} /> : null}
        {/* Issues attach to an existing pole record, so only offer this once one is found. */}
        {pole ? <ReportIssueSection poleNumber={pole.poleNumber} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  gap: { gap: space.md },
});
