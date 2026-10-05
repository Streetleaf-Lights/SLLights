import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { QueryState } from "@/api/useApiQuery";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { colors, space } from "./theme";

/** Loading spinner or error-with-retry for a screen's query. Renders nothing once data is in. */
export function QueryStatus({ state, onRetry }: { state: QueryState<unknown>; onRetry: () => void }) {
  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading" color={colors.accentStrong} size="large" />
      </View>
    );
  }
  if (state.status === "error") {
    return (
      <View style={styles.error}>
        <Banner tone="error" message={state.message} />
        <Button label="Try again" variant="secondary" onPress={onRetry} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  error: { padding: space.lg, gap: space.md },
});
