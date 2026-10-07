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
 * The web's Set your password, opened from the emailed invite
 * (/register?token=…). Completing it signs the person straight in — the
 * root layout then moves them into the app.
 */
export default function RegisterScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const inviteToken = typeof token === "string" ? token.trim() : "";
  const { register } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = checkNewPassword(password, confirmation);

  // Arriving from an emailed link skips the launch welcome: without this,
  // finishing here would detour through the 5-second welcome screen before
  // the app (or Sign In) — the welcome was never shown, so never "done".
  const { finish: skipWelcome } = useIntro();
  useEffect(() => skipWelcome(), [skipWelcome]);

  async function submit() {
    if (!inviteToken) {
      setError("This invite link is invalid or missing. Please request a new one.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await register(inviteToken, password);
      // Signed in: the root layout's guard takes them into the app.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setSaving(false);
    }
  }

  return (
    <AuthScreen title="Set your password" intro="Choose a password to finish setting up your Streetleaf account.">
      {!inviteToken ? <Banner tone="error" message="This invite link is invalid or missing. Please request a new one." /> : null}
      <NewPasswordFields
        password={password}
        confirmation={confirmation}
        checks={checks}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
      />
      {error ? <Banner tone="error" message={error} /> : null}
      <Button
        label="Set password"
        loading={saving}
        disabled={!inviteToken || !checks.valid || !checks.matches}
        onPress={() => void submit()}
      />
      <Button label="Back to Sign In" variant="secondary" onPress={() => router.replace("/sign-in")} />
    </AuthScreen>
  );
}
