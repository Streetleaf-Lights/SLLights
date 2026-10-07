import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { checkNewPassword } from "@sllights/shared/password";
import { useAuth } from "@/auth/AuthProvider";
import { useIntro } from "@/intro/IntroProvider";
import { AuthScreen } from "@/account/AuthScreen";
import { NewPasswordFields } from "@/account/NewPasswordFields";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";

/**
 * The web's Reset your password, opened from the emailed link
 * (/reset-password?token=…). Same rules as the web form; on success, back to
 * Sign In with the new password.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const resetToken = typeof token === "string" ? token.trim() : "";
  const { api } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const checks = checkNewPassword(password, confirmation);

  // Arriving from an emailed link skips the launch welcome: without this,
  // finishing here would detour through the 5-second welcome screen before
  // the app (or Sign In) — the welcome was never shown, so never "done".
  const { finish: skipWelcome } = useIntro();
  useEffect(() => skipWelcome(), [skipWelcome]);

  async function reset() {
    if (!resetToken) {
      setError("This reset link is invalid or missing. Please request a new one.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.resetPassword(resetToken, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <AuthScreen title="Password reset" intro="Your password has been reset. You can now sign in with your new password.">
        <Button label="Back to Sign In" onPress={() => router.replace("/sign-in")} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Reset your password">
      {!resetToken ? <Banner tone="error" message="This reset link is invalid or missing. Please request a new one." /> : null}
      <NewPasswordFields
        password={password}
        confirmation={confirmation}
        checks={checks}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
      />
      {error ? <Banner tone="error" message={error} /> : null}
      <Button
        label="Reset password"
        loading={saving}
        disabled={!resetToken || !checks.valid || !checks.matches}
        onPress={() => void reset()}
      />
      <Button label="Back to Sign In" variant="secondary" onPress={() => router.replace("/sign-in")} />
    </AuthScreen>
  );
}
