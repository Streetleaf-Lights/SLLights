import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";
import { colors, space, type } from "@/ui/theme";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Navigation happens via Stack.Protected once the session is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require("../assets/streetleaf-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Streetleaf"
          />
          <View style={styles.intro}>
            <Text style={type.title}>Sign in</Text>
            <Text style={type.small}>Use the same email and password as the Streetleaf dashboard.</Text>
          </View>

          {error ? <Banner tone="error" message={error} /> : null}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <Button label="Sign in" onPress={handleSubmit} loading={submitting} />
          <Text style={[type.small, styles.footnote]}>
            Forgot your password? Reset it from the Streetleaf dashboard on the web.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, paddingTop: space.xxl * 2 },
  logo: { width: 180, height: 48, marginBottom: space.lg },
  intro: { gap: space.xs, marginBottom: space.sm },
  footnote: { textAlign: "center", marginTop: space.sm },
});
