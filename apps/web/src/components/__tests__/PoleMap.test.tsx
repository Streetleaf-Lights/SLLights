import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { LocationMapMock } = vi.hoisted(() => ({ LocationMapMock: vi.fn(() => null) }));

vi.mock("@/components/LocationMap", () => ({
  LocationMap: LocationMapMock,
}));

import { PoleMap } from "@/components/PoleMap";

describe("PoleMap", () => {
  it("passes a single point (with lat/long as lat/long, not lat/lng) to LocationMap", () => {
    render(<PoleMap lat={29.9511} long={-90.0715} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [{ lat: 29.9511, long: -90.0715 }] }),
      undefined,
    );
  });

  it("passes the pole-specific empty message to LocationMap", () => {
    render(<PoleMap lat={29.9511} long={-90.0715} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ emptyMessage: "No location on file for this pole." }),
      undefined,
    );
  });

  it("passes no points when lat is missing", () => {
    render(<PoleMap lat={null} long={-90.0715} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [] }),
      undefined,
    );
  });

  it("passes no points when long is missing", () => {
    render(<PoleMap lat={29.9511} long={null} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [] }),
      undefined,
    );
  });

  it("passes no points when both coordinates are missing", () => {
    render(<PoleMap lat={null} long={null} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [] }),
      undefined,
    );
  });

  it("passes no points when lat is undefined (the API omits the field entirely rather than nulling it)", () => {
    render(<PoleMap lat={undefined} long={-90.0715} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [] }),
      undefined,
    );
  });

  it("passes no points when long is undefined", () => {
    render(<PoleMap lat={29.9511} long={undefined} />);

    expect(LocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({ points: [] }),
      undefined,
    );
  });
});
