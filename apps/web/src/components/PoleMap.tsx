import { LocationMap } from "@/components/LocationMap";

export function PoleMap({ lat, long }: { lat: number | null | undefined; long: number | null | undefined }) {
  const points = lat != null && long != null ? [{ lat, long }] : [];
  return <LocationMap points={points} emptyMessage="No location on file for this pole." />;
}
