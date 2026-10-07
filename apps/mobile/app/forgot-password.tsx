import { useState } from "react";
import { useRouter } from "expo-router";
import { INVITE_EMAIL_PATTERN } from "@sllights/shared/users";
import { useAuth } from "@/auth/AuthProvider";
import { AuthScreen } from "@/account/AuthScreen";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

/**
 * The web's Forgot password: asks for a reset link. The answer is the same
 * generic message whether or not the email has an account (deliberate — it
 * doesn't reveal who has one).
 */
export default function ForgotPasswordScreen() {
  const { api } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmed = email.trim();
  const emailError = touched ? (!trimmed ? "Email is required." : !INVITE_EMAIL_PATTERN.test(trimmed) ? "Enter a valid email address." : null) : null;

  async function send() {
    setSending(true);
    setError(null);
    try {
      setSent((await api.forgotPassword(trimmed)).message || "If that email exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthScreen title="Forgot password" intro="Enter your email and we’ll send you a link to reset your password.">
      <TextField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setTouched(true);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        editable={!sent}
      />
      {emailError ? <Banner tone="error" message={emailError} /> : null}
      {error ? <Banner tone="error" message={error} /> : null}
      {sent ? <Banner tone="success" message={sent} /> : null}
      <Button
        label="Send reset link"
        loading={sending}
        disabled={Boolean(sent) || !INVITE_EMAIL_PATTERN.test(trimmed)}
        onPress={() => void send()}
      />
      <Button label="Back to Sign In" variant="secondary" onPress={() => router.replace("/sign-in")} />
    </AuthScreen>
  );
}
