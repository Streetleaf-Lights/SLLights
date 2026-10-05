import { useCallback } from "react";
import { Stack, useLocalSearchParams, useNavigation } from "expo-router";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { ProjectDetailView } from "@/monitoring/ProjectDetailView";

export default function ProjectScreen() {
  const { customerId, projectId } = useLocalSearchParams<{ customerId: string; projectId: string }>();
  const { claims } = useSignedInUser();
  const navigation = useNavigation();
  const setTitle = useCallback((name: string) => navigation.setOptions({ title: name }), [navigation]);
  return (
    <>
      <Stack.Screen options={{ title: "Project" }} />
      <ProjectDetailView
        customerId={String(customerId)}
        projectId={String(projectId)}
        viewerScoped={isCustomerScoped(claims.role, claims.customerId)}
        onLoaded={setTitle}
      />
    </>
  );
}
