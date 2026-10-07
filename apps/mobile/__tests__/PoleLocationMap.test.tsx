import { Linking, Platform } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PoleLocationMap } from "@/pole/PoleLocationMap";
import { nativeMapsUrl, webMapsUrl } from "@/location/mapsUrl";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const originalOS = Platform.OS;
const setPlatform = (os: "ios" | "android") => Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

describe("PoleLocationMap", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setPlatform(originalOS as "ios" | "android"); // don't leak the platform into other tests
  });

  it("shows one marker at the pole, at street-level zoom, labelled with the pole number", async () => {
    await render(<PoleLocationMap lat={27.95} long={-82.46} poleNumber="PAS-1" />);
    const map = screen.getByTestId("pole-map");
    expect(map.props.initialRegion).toEqual({ latitude: 27.95, longitude: -82.46, latitudeDelta: 0.004, longitudeDelta: 0.004 });
    const marker = screen.getByTestId("map-marker");
    expect(marker.props.coordinate).toEqual({ latitude: 27.95, longitude: -82.46 });
    expect(marker.props.title).toBe("PAS-1");
  });

  it("is a fixed view, so the page scrolls instead of the map", async () => {
    await render(<PoleLocationMap lat={27.95} long={-82.46} poleNumber="PAS-1" />);
    const map = screen.getByTestId("pole-map");
    expect(map.props).toMatchObject({ scrollEnabled: false, zoomEnabled: false, rotateEnabled: false, pitchEnabled: false });
  });

  it.each([
    ["no latitude", null, -82.46],
    ["no longitude", 27.95, null],
    ["out of range", 120, -82.46],
  ])("says there's no location on file when there's %s", async (_label, lat, long) => {
    await render(<PoleLocationMap lat={lat} long={long} poleNumber="PAS-1" />);
    expect(screen.getByText("No location on file for this pole.")).toBeTruthy();
    expect(screen.queryByTestId("pole-map")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open in Maps" })).toBeNull();
  });

  it.each([
    ["ios", "https://maps.apple.com/?ll=27.95,-82.46&q=PAS-1"],
    ["android", "geo:27.95,-82.46?q=27.95,-82.46(PAS-1)"],
  ] as const)("opens the location in the phone's maps app on %s", async (os, url) => {
    setPlatform(os);
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(<PoleLocationMap lat={27.95} long={-82.46} poleNumber="PAS-1" />);
    await fireEvent.press(screen.getByRole("button", { name: "Open in Maps" }));
    expect(openURL).toHaveBeenCalledWith(url);
  });

  it("falls back to Google Maps on the web if the maps app can't be opened", async () => {
    setPlatform("android");
    const openURL = jest.spyOn(Linking, "openURL").mockRejectedValueOnce(new Error("no handler")).mockResolvedValue(true);
    await render(<PoleLocationMap lat={27.95} long={-82.46} poleNumber="PAS-1" />);
    await fireEvent.press(screen.getByRole("button", { name: "Open in Maps" }));
    await waitFor(() => expect(openURL).toHaveBeenLastCalledWith("https://www.google.com/maps/search/?api=1&query=27.95,-82.46"));
  });
});

describe("maps URLs", () => {
  it("encodes the label", () => {
    expect(nativeMapsUrl("ios", 1, 2, "PAS 1&2")).toBe("https://maps.apple.com/?ll=1,2&q=PAS%201%262");
    expect(nativeMapsUrl("android", 1, 2, "PAS 1")).toBe("geo:1,2?q=1,2(PAS%201)");
    expect(webMapsUrl(1, 2)).toBe("https://www.google.com/maps/search/?api=1&query=1,2");
  });
});
