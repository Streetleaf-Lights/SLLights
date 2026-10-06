import { useCallback } from "react";
import { useLocalSearchParams, useNavigation } from "expo-router";
import type { PoleDetailResponse } from "@sllights/shared/api-contract";
import { PoleDetailView } from "@/pole/PoleDetailView";
import { HeaderBackButton } from "@/ui/HeaderBackButton";

/**
 * A pole opened from a project's pole list — the web pole page. The pole
 * number is in the page header, so the top bar stays untitled and its back
 * button names the project it returns to.
 */
export default function PoleScreen() {
  const { customerId, projectId, poleId } = useLocalSearchParams<{
    customerId: string;
    projectId: string;
    poleId: string;
  }>();
  const navigation = useNavigation();
  const showProjectOnBack = useCallback(
    (data: PoleDetailResponse) => navigation.setOptions({
        headerLeft: () => <HeaderBackButton label={data.project.name} onPress={() => navigation.goBack()} />,
      }),
    [navigation],
  );
  return (
    <PoleDetailView
      customerId={String(customerId)}
      projectId={String(projectId)}
      poleId={String(poleId)}
      onLoaded={showProjectOnBack}
    />
  );
}
