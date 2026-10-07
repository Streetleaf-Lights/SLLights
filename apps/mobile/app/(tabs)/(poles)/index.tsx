import { useRouter } from "expo-router";
import { PolesListView } from "@/monitoring/PolesListView";

/** The web's Poles page (left-nav "Poles"): every pole the viewer may see. */
export default function PolesTab() {
  const router = useRouter();
  return (
    <PolesListView
      onOpenPole={(row) =>
        router.push({
          // Named with its group so the pole opens inside the Poles tab.
          pathname: "/(tabs)/(poles)/pole/[customerId]/[projectId]/[poleId]",
          params: { customerId: row.customerId, projectId: row.projectId, poleId: row.id },
        })
      }
    />
  );
}
