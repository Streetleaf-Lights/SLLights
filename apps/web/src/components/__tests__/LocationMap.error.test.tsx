import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { importLibraryMock } = vi.hoisted(() => ({
  importLibraryMock: vi.fn(() => Promise.reject(new Error("network down"))),
}));

vi.mock("@googlemaps/js-api-loader", () => ({
  setOptions: vi.fn(),
  importLibrary: importLibraryMock,
}));

import { LocationMap } from "@/components/LocationMap";

describe("LocationMap (load error)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID", "test-map-id");
  });

  it("shows a load-error message if the Maps libraries fail to load", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    expect(
      await screen.findByText("Failed to load the map. Please try again later."),
    ).toBeInTheDocument();
  });

  it("does not render the map container when loading fails", async () => {
    render(<LocationMap points={[{ lat: 29.95, long: -90.07 }]} emptyMessage="No points." />);

    await screen.findByText("Failed to load the map. Please try again later.");
    expect(screen.queryByRole("application", { name: "Map" })).not.toBeInTheDocument();
  });
});
