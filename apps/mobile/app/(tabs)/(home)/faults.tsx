import { useLocalSearchParams, useRouter } from "expo-router";
import { PolesListView } from "@/monitoring/PolesListView";

/**
 * The web's "Total faults" view: faulted, recently-reporting poles for a
 * customer (from its overview) or one project (from the project screen).
 */
export default function FaultsScreen() {
  const { customerId, projectId } = useLocalSearchParams<{ customerId: string; projectId?: string }>();
  const router = useRouter();
  return (
    <PolesListView
      faults={{ customerId: String(customerId), ...(projectId ? { projectId: String(projectId) } : {}) }}
      onOpenPole={(row) =>
        router.push({
          pathname: "/project/[customerId]/[projectId]/pole/[poleId]",
          params: { customerId: row.customerId, projectId: row.projectId, poleId: row.id },
        })
      }
    />
  );
}
