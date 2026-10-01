import { useCallback, useState } from "react";
import * as Location from "expo-location";

/** Above this, the pin could land on the wrong side of a street — warn the crew. */
export const POOR_ACCURACY_METERS = 25;

export interface LocationFix {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
}

export type LocationState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "fixed"; fix: LocationFix }
  | { status: "denied" }
  | { status: "error"; message: string };

/** One-shot, high-accuracy position for tagging an install. Foreground permission only. */
export function useLocationFix() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const capture = useCallback(async () => {
    setState({ status: "locating" });
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setState({ status: "denied" });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setState({
        status: "fixed",
        fix: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
        },
      });
    } catch {
      setState({
        status: "error",
        message: "Couldn't get a location. Make sure location services are on, then try again.",
      });
    }
  }, []);

  return { state, capture };
}
