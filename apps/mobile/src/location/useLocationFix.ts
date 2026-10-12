import { useCallback, useEffect, useState } from "react";
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

/** Reads one high-accuracy position (asking for foreground permission). Never throws. */
async function readFix(): Promise<LocationState> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: "denied" };
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      status: "fixed",
      fix: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy ?? null,
      },
    };
  } catch {
    return { status: "error", message: "Couldn't get a location. Make sure location services are on, then try again." };
  }
}

/**
 * One-shot, high-accuracy position for tagging an install. Foreground
 * permission only. With `auto`, it starts locating as soon as the screen
 * opens (GPS works without an internet connection).
 */
export function useLocationFix({ auto = false }: { auto?: boolean } = {}) {
  const [state, setState] = useState<LocationState>(auto ? { status: "locating" } : { status: "idle" });

  const capture = useCallback(async () => {
    setState({ status: "locating" });
    setState(await readFix());
  }, []);

  useEffect(() => {
    if (!auto) return;
    let cancelled = false;
    void readFix().then((result) => {
      if (!cancelled) setState(result); // not after the screen has closed
    });
    return () => {
      cancelled = true;
    };
  }, [auto]);

  return { state, capture };
}
