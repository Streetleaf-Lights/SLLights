import { Linking, Platform, StyleSheet, View } from "react-native";
import { hasMapLocation } from "@sllights/shared/pole-detail";
import { LocationMap } from "@/location/LocationMap";
import { nativeMapsUrl, webMapsUrl } from "@/location/mapsUrl";
import { Button } from "@/ui/Button";
import { space } from "@/ui/theme";

/**
 * The pole page's Location (the web's PoleMap): a LocationMap with just
 * this pole, plus "Open in Maps" to hand the location to the phone's maps
 * app for a full map and directions.
 */
export function PoleLocationMap({
  lat,
  long,
  poleNumber,
}: {
  lat: number | null;
  long: number | null;
  poleNumber: string;
}) {
  const map = (
    <LocationMap
      testID="pole-map"
      points={[{ id: poleNumber, lat, long, label: poleNumber }]}
      emptyMessage="No location on file for this pole."
    />
  );
  if (!hasMapLocation(lat, long)) return map;

  const latitude = lat as number;
  const longitude = long as number;
  async function openInMaps() {
    try {
      await Linking.openURL(nativeMapsUrl(Platform.OS, latitude, longitude, poleNumber));
    } catch {
      await Linking.openURL(webMapsUrl(latitude, longitude)).catch(() => undefined);
    }
  }

  return (
    <View style={styles.card}>
      {map}
      <Button label="Open in Maps" variant="secondary" onPress={() => void openInMaps()} />
    </View>
  );
}

const styles = StyleSheet.create({ card: { gap: space.sm } });
