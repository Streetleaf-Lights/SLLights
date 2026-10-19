import { useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "@/auth/AuthProvider";

/**
 * "Delete my account" for any signed-in person (Customer Owners included):
 * asks first, then deletes their own account and signs out on this phone —
 * the sign-in screen then confirms it. If the server refuses, they stay
 * signed in and see why. Used by the Account screen and your own row in
 * Users. (Apple requires apps that support account creation to offer this.)
 */
export function useDeleteMyAccount() {
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteMyAccount = () =>
    Alert.alert(
      "Delete your account?",
      "Your account and sign-in will be deleted and you'll be signed out. You won't be able to use the Streetleaf Lights app or the dashboard. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(); // signs out: the sign-in screen takes over
            } catch (err) {
              setDeleting(false);
              Alert.alert("Couldn't delete your account", err instanceof Error ? err.message : "Please try again.");
            }
          },
        },
      ],
    );

  return { confirmDeleteMyAccount, deleting };
}
