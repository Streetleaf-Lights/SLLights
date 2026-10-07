import { useLocalSearchParams } from "expo-router";
import { PoleDetailView } from "@/pole/PoleDetailView";

/** A pole opened from the Poles list — the same web-style pole page. */
export default function PolesTabPoleScreen() {
  const { customerId, projectId, poleId } = useLocalSearchParams<{
    customerId: string;
    projectId: string;
    poleId: string;
  }>();
  return <PoleDetailView customerId={String(customerId)} projectId={String(projectId)} poleId={String(poleId)} />;
}
