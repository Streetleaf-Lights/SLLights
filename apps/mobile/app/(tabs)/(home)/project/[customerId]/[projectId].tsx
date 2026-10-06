import { useCallback } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import type { ProjectDetailResponse } from "@sllights/shared/api-contract";
import { isCustomerScoped } from "@sllights/shared/auth-role";
import { useSignedInUser } from "@/auth/AuthProvider";
import { ProjectDetailView } from "@/monitoring/ProjectDetailView";
import { HeaderBackButton } from "@/ui/HeaderBackButton";

/**
 * A project's stats and poles. The project name is already in the page
 * header, so the top bar stays untitled; instead the back button names the
 * customer it returns to ("‹ Coastal Power") once the project has loaded.
 */
export default function ProjectScreen() {
  const { customerId, projectId } = useLocalSearchParams<{ customerId: string; projectId: string }>();
  const { claims } = useSignedInUser();
  const navigation = useNavigation();
  const showCustomerOnBack = useCallback(
    (data: ProjectDetailResponse) => navigation.setOptions({
        headerLeft: () => <HeaderBackButton label={data.customer.name} onPress={() => navigation.goBack()} />,
      }),
    [navigation],
  );
  return (
    <ProjectDetailView
      customerId={String(customerId)}
      projectId={String(projectId)}
      viewerScoped={isCustomerScoped(claims.role, claims.customerId)}
      onLoaded={showCustomerOnBack}
    />
  );
}
