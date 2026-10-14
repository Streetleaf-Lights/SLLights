import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { canUseFieldTools } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { colors, radius, space, type } from "@/ui/theme";
import { useInstallQueue } from "./InstallQueueProvider";

/**
 * TESTING ONLY — shown in development builds (__DEV__), never in the release
 * app crews use: lets the phone forget which stickers it has submitted, so
 * test poles appear in the Install form again. Airtable is unchanged — to
 * really re-submit a pole, delete its test record there too.
 */
export function TestingTools({ isDev = __DEV__ }: { isDev?: boolean }) {
  const { claims } = useSignedInUser();
  const { forgetSubmittedStickers, submittedStickers } = useInstallQueue();
  const [done, setDone] = useState(false);
  if (!isDev || !canUseFieldTools(claims.role)) return null;

  const confirm = () =>
    Alert.alert(
      "Forget submitted stickers?",
      "Sent poles show in the Install form again. Installs still waiting on this phone are kept. Airtable isn't changed: delete a pole's test record there before submitting it again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Forget",
          style: "destructive",
          onPress: () => void forgetSubmittedStickers().then(() => setDone(true)),
        },
      ],
    );

  return (
    <View style={styles.box} testID="testing-tools">
      <Text style={styles.title}>Testing (development builds only)</Text>
      <Text style={type.small}>
        {submittedStickers.size === 1 ? "1 sticker" : `${submittedStickers.size} stickers`} marked as submitted on this phone.
      </Text>
      {done ? <Banner tone="success" message="Done. Sent poles show in the Install form again." /> : null}
      <Button label="Forget submitted stickers" variant="secondary" onPress={confirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.statusWarning,
    borderRadius: radius.md,
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.statusWarning },
});
