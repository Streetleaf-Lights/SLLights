import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { hasMapLocation, mapRegionForPoints } from "@sllights/shared/pole-detail";
import { colors, radius, space } from "@/ui/theme";

export interface MapPoint {
  id: string;
  lat: number | null;
  long: number | null;
  label: string;
}

export const MAP_HEIGHT = 220;

/**
 * The web's LocationMap on mobile: one marker per point (labelled), framed
 * to fit them all — street level for a single point — or `emptyMessage`
 * when none has usable coordinates. A fixed view (no pan/zoom) so it never
 * traps the page's scroll.
 *
 * Apple Maps on iOS, Google Maps on Android (Android builds need a Google
 * Maps API key — see app.config.js; in Expo Go, Android maps can show grey).
 */
export function LocationMap({
  points,
  emptyMessage,
  testID = "location-map",
}: {
  points: readonly MapPoint[];
  emptyMessage: string;
  testID?: string;
}) {
  const plotted = points.filter((p) => hasMapLocation(p.lat, p.long));
  const region = mapRegionForPoints(plotted);

  if (!region) {
    return (
      <View style={[styles.frame, styles.message]}>
        <Text style={styles.messageText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <MapView
        testID={testID}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel={
          plotted.length === 1 ? `Map showing pole ${plotted[0].label}` : `Map showing ${plotted.length} poles`
        }
      >
        {plotted.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat as number, longitude: p.long as number }} title={p.label} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: MAP_HEIGHT,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  message: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  messageText: { fontSize: 13, color: colors.inkFaint, textAlign: "center" },
});
