import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, space, type } from "@/ui/theme";

/** The shared frame of the signed-out screens (sign-in's look): title, intro text, content. */
export function AuthScreen({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={type.title} accessibilityRole="header">
              {title}
            </Text>
            {intro ? <Text style={type.small}>{intro}</Text> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, paddingTop: space.xxl * 2 },
  intro: { gap: space.xs, marginBottom: space.sm },
});
