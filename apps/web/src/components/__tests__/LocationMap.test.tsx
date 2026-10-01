import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";

const {
  setOptionsMock,
  importLibraryMock,
  MapMock,
  AdvancedMarkerElementMock,
  fitBoundsMock,
  extendMock,
} = vi.hoisted(() => ({
  setOptionsMock: vi.fn(),
  importLibraryMock: vi.fn(),
  MapMock: vi.fn(),
  AdvancedMarkerElementMock: vi.fn(),
  fitBoundsMock: vi.fn(),
  extendMock: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: setOptionsMock,
  importLibrary: importLibraryMock,
}));

import { LocationMap } from "@/components/LocationMap";

describe("LocationMap", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", "test-map-id");

    setOptionsMock.mockClear();
    AdvancedMarkerElementMock.mockClear();
    fitBoundsMock.mockClear();
    extendMock.mockClear();
    MapMock.mockClear();

    MapMock.mockImplementation(function () {
      return { fitBounds: fitBoundsMock };
    });
    const LatLngBoundsMock = vi.fn(function () {
      return { extend: extendMock };
    });
    importLibraryMock.mockImplementation((name: string) => {
      if (name === "core") return Promise.resolve({ LatLngBounds: LatLngBoundsMock });
      if (name === "maps") return Promise.resolve({ Map: MapMock });
      if (name === "marker")
        return Promise.resolve({ AdvancedMarkerElement: AdvancedMarkerElementMock });
      return Promise.reject(new Error(`unexpected library: ${name}`));
    });
  });

  it("shows the emptyMessage and never calls the loader when there are no points", () => {
    render(<LocationMap points={[]} emptyMessage="No poles have location data." />);

    expect(screen.getByText("No poles have location data.")).toBeInTheDocument();
    expect(importLibraryMock).not.toHaveBeenCalled();
  });

  it("shows a config-needed message and never calls the loader when the API key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");

    render(<LocationMap points={[{ lat: 1, long: 2 }]} emptyMessage="No points." />);

    expect(
      screen.getByText(
        "Map is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to enable it.",
      ),
    ).toBeInTheDocument();
    expect(importLibraryMock).not.toHaveBeenCalled();
  });

  it("shows a config-needed message and never calls the loader when the Map ID is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", "");

    render(<LocationMap points={[{ lat: 1, long: 2 }]} emptyMessage="No points." />);

    expect(
      screen.getByText(
        "Map is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to enable it.",
      ),
    ).toBeInTheDocument();
    expect(importLibraryMock).not.toHaveBeenCalled();
  });

  it("renders the map container and sets API options once a key, Map ID, and points are present", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    expect(screen.getByRole("application", { name: "Map" })).toBeInTheDocument();
    await waitFor(() =>
      expect(setOptionsMock).toHaveBeenCalledWith({ key: "test-api-key", v: "weekly" }),
    );
  });

  it("shows the load-error message when Google's own gm_authFailure callback fires (an invalid key, billing not enabled, etc.)", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);
    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("application", { name: "Map" })).toBeInTheDocument();

    act(() => {
      window.gm_authFailure?.();
    });

    expect(
      await screen.findByText("Failed to load the map. Please try again later."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("application", { name: "Map" })).not.toBeInTheDocument();
  });

  it("shows the load-error message on every currently-mounted LocationMap when gm_authFailure fires once, not just one of them", async () => {
    render(
      <>
        <LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />
        <LocationMap points={[{ lat: 30.0, long: -91.0 }]} emptyMessage="No points." />
      </>,
    );
    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(2));

    act(() => {
      window.gm_authFailure?.();
    });

    const errorMessages = await screen.findAllByText(
      "Failed to load the map. Please try again later.",
    );
    expect(errorMessages).toHaveLength(2);
  });

  it("does not error when gm_authFailure fires after a LocationMap has already unmounted", async () => {
    const { unmount } = render(
      <LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />,
    );
    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));

    unmount();

    expect(() => window.gm_authFailure?.()).not.toThrow();
  });

  it("passes the Map ID to the Map constructor", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));
    expect(MapMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mapId: "test-map-id" }),
    );
  });

  it("creates a single AdvancedMarkerElement (not LatLngBounds/fitBounds) for one point", async () => {
    render(
      <LocationMap
        points={[{ lat: 29.95, long: -90.07, label: "Pole A" }]}
        emptyMessage="No points."
      />,
    );

    await waitFor(() => expect(AdvancedMarkerElementMock).toHaveBeenCalledTimes(1));
    expect(AdvancedMarkerElementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { lat: 29.95, lng: -90.07 },
        title: "Pole A",
      }),
    );
    expect(fitBoundsMock).not.toHaveBeenCalled();
  });

  it("creates one AdvancedMarkerElement per point and fits bounds to all of them for multiple points", async () => {
    const points = [
      { lat: 29.95, long: -90.07, label: "Pole A" },
      { lat: 29.96, long: -90.08, label: "Pole B" },
      { lat: 29.97, long: -90.09, label: "Pole C" },
    ];
    render(<LocationMap points={points} emptyMessage="No points." />);

    await waitFor(() => expect(AdvancedMarkerElementMock).toHaveBeenCalledTimes(3));
    expect(extendMock).toHaveBeenCalledTimes(3);
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
  });

  it("centers the map on the first point and zooms in more for a single point than for multiple", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));
    expect(MapMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ center: { lat: 29.95, lng: -90.07 }, zoom: 16 }),
    );
  });

  it("does not rebuild the map when re-rendered with a new-but-equivalent points array", async () => {
    const { rerender } = render(
      <LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />,
    );

    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));

    // A brand-new array with a brand-new object literal, but the same
    // coordinates — this is exactly what callers rebuild on every render.
    rerender(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    // Give any (incorrect) re-run a chance to happen before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(MapMock).toHaveBeenCalledTimes(1);
  });

  it("does rebuild the map when the coordinates actually change", async () => {
    const { rerender } = render(
      <LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />,
    );

    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(1));

    rerender(<LocationMap points={[{ lat: 30.0, long: -91.0 }]} emptyMessage="No points." />);

    await waitFor(() => expect(MapMock).toHaveBeenCalledTimes(2));
  });
});
