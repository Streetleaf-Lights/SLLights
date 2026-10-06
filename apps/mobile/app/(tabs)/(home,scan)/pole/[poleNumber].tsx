import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import type { PoleSummary } from "@sllights/shared/types";
import { useAuth } from "@/auth/AuthProvider";
import { InstallSection } from "@/pole/InstallSection";
import { PoleDetailView } from "@/pole/PoleDetailView";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { colors, space, type } from "@/ui/theme";

type Lookup =
  | { status: "loading" }
  | { status: "done"; pole: PoleSummary | null }
  | { status: "error"; message: string };

/**
 * A pole opened by number (the Scan tab). Finds the pole, then shows the
 * same web-style pole page as the project list, with install recording
 * underneath for Streetleaf Admin/Crew. An unknown number can still be
 * recorded as a new install.
 */
export default function ScannedPoleScreen() {
  const params = useLocalSearchParams<{ poleNumber: string; scanned?: string }>();
  const poleNumber = String(params.poleNumber ?? "").toUpperCase();
  const scannedValue = typeof params.scanned === "string" ? params.scanned : null;
  const { api, state: auth } = useAuth();
  // Recording installs is field work: Streetleaf Admin and Crew only (the server enforces this too).
  const canRecordInstall = auth.status === "signedIn" && canUseFieldTools(auth.claims.role);
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

  const install = canRecordInstall ? <InstallSection poleNumber={poleNumber} scannedValue={scannedValue} /> : null;
  const found = lookup.status === "done" ? lookup.pole : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: found ? "" : poleNumber }} />
      {found ? (
        <PoleDetailView
          customerId={found.customerId}
          projectId={found.projectId}
          poleId={found.id}
          footer={install ? <View style={styles.footer}>{install}</View> : null}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.code}>{poleNumber}</Text>
          {lookup.status === "loading" ? (
            <ActivityIndicator accessibilityLabel="Looking up pole" color={colors.accentStrong} />
          ) : null}
          {lookup.status === "error" ? (
            <View style={styles.gap}>
              <Banner tone="error" message={lookup.message} />
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => {
                  setLookup({ status: "loading" });
                  setAttempt((n) => n + 1);
                }}
              />
            </View>
          ) : null}
          {lookup.status === "done" ? (
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
          {lookup.status !== "loading" ? install : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl * 2 },
  gap: { gap: space.md },
  footer: { marginTop: space.lg },
});
