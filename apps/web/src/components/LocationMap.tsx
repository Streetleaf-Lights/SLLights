"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

declare global {
  interface Window {
    /** Google's own documented global callback for a Maps JS API auth failure. */
    gm_authFailure?: () => void;
  }
}

export interface MapPoint {
  lat: number;
  long: number;
  label?: string;
}

const DEFAULT_HEIGHT = "h-64";

// Module-level (not per-component-instance) so multiple LocationMap
// instances on one page — or across navigations — share a single set of
// library imports instead of each triggering its own Maps script load.
let optionsSet = false;
let librariesPromise: Promise<
  [google.maps.CoreLibrary, google.maps.MapsLibrary, google.maps.MarkerLibrary]
> | null = null;

/**
 * gm_authFailure is Google's own documented global callback, invoked when
 * the Maps JavaScript API loads successfully but then fails
 * authentication — an invalid/restricted API key, billing not enabled on
 * the Google Cloud project, or the Maps JavaScript API not enabled there.
 * Without this, Google's own JS silently overlays "This page can't load
 * Google Maps correctly" directly onto the map canvas — a developer-
 * facing message, not something this app renders, and not something a
 * .catch() on importLibrary() can detect (the library itself does load
 * fine; it's the subsequent authentication check against Google's own
 * servers that fails). Registering this callback lets every mounted
 * LocationMap show its own existing error state instead. Only one such
 * global function can be registered at a time, so this fans a single
 * call out to every currently-mounted instance via a shared listener set,
 * rather than each instance overwriting the others' registration.
 */
const authFailureListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.gm_authFailure = () => {
    for (const listener of authFailureListeners) listener();
  };
}

function loadGoogleMapsLibraries(apiKey: string) {
  if (!optionsSet) {
    setOptions({ key: apiKey, v: "weekly" });
    optionsSet = true;
  }
  if (!librariesPromise) {
    librariesPromise = Promise.all([
      importLibrary("core"),
      importLibrary("maps"),
      importLibrary("marker"),
    ]);
  }
  return librariesPromise;
}

function MapMessage({ tone, height, children }: { tone: "muted" | "error"; height: string; children: React.ReactNode }) {
  return (
    <div
      className={`flex ${height} w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-center text-[12.5px] ${
        tone === "error" ? "text-[var(--status-flagged)]" : "text-[var(--ink-faint)]"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Renders one marker per point, centered/zoomed to fit all of them. Uses
 * the Maps JavaScript API (not the Maps Embed API) since Embed API has no
 * mode that supports plotting an arbitrary set of custom markers — only
 * the JS API can do that. Uses AdvancedMarkerElement (not the older,
 * soft-deprecated google.maps.Marker) — this is why a Map ID is required
 * in addition to the API key.
 */
export function LocationMap({
  points,
  emptyMessage,
  height = DEFAULT_HEIGHT,
}: {
  points: MapPoint[];
  emptyMessage: string;
  height?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  // Callers (PoleMap, the project detail page) rebuild `points` — a fresh
  // array of fresh object literals — on every render, even when the actual
  // coordinates haven't changed. Using that array directly as an effect
  // dependency would re-run the effect (tearing down and rebuilding the
  // whole map) on every unrelated parent re-render. This derives a stable
  // primitive to depend on instead; `points` itself is still read from the
  // closure inside the effect, which correctly reflects the same render.
  const pointsKey = points.map((point) => `${point.lat},${point.long}`).join(";");

  useEffect(() => {
    const onAuthFailure = () => setLoadError(true);
    authFailureListeners.add(onAuthFailure);
    return () => {
      authFailureListeners.delete(onAuthFailure);
    };
  }, []);

  useEffect(() => {
    if (!apiKey || !mapId || points.length === 0 || !containerRef.current) return;

    let cancelled = false;
    loadGoogleMapsLibraries(apiKey)
      .then(([core, maps, marker]) => {
        if (cancelled || !containerRef.current) return;

        const map = new maps.Map(containerRef.current, {
          mapId,
          center: { lat: points[0].lat, lng: points[0].long },
          zoom: points.length === 1 ? 16 : 12,
        });

        if (points.length === 1) {
          new marker.AdvancedMarkerElement({
            position: { lat: points[0].lat, lng: points[0].long },
            map,
            title: points[0].label,
          });
          return;
        }

        const bounds = new core.LatLngBounds();
        for (const point of points) {
          const position = { lat: point.lat, lng: point.long };
          new marker.AdvancedMarkerElement({ position, map, title: point.label });
          bounds.extend(position);
        }
        map.fitBounds(bounds);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pointsKey is the intentional stand-in for points (see comment above); points itself is read from the closure.
  }, [apiKey, mapId, pointsKey]);

  if (!apiKey || !mapId) {
    return (
      <MapMessage tone="muted" height={height}>
        Map is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and
        NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to enable it.
      </MapMessage>
    );
  }

  if (points.length === 0) {
    return (
      <MapMessage tone="muted" height={height}>
        {emptyMessage}
      </MapMessage>
    );
  }

  if (loadError) {
    return (
      <MapMessage tone="error" height={height}>
        Failed to load the map. Please try again later.
      </MapMessage>
    );
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Map"
      className={`${height} w-full rounded-lg border border-[var(--border)]`}
    />
  );
}
