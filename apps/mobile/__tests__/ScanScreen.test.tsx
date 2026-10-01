import { act, fireEvent, render, screen } from "@testing-library/react-native";
import ScanScreen from "../app/(tabs)/index";

const mockPush = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
const mockRequestPermission = jest.fn();

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  };
});

jest.mock("expo-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    CameraView: (props: Record<string, unknown>) => <View {...props} />,
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const Haptics = jest.requireMock("expo-haptics");

async function scan(data: string) {
  await act(async () => {
    screen.getByTestId("scanner-camera").props.onBarcodeScanned({ type: "qr", data });
  });
}

describe("ScanScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
    Haptics.notificationAsync.mockClear();
    mockPermission = { granted: true, canAskAgain: true };
  });

  it("opens the pole screen for a valid scan, with success haptics and the raw value", async () => {
    await render(<ScanScreen />);
    await scan("https://streetleaf.com/poles/pas-4938");

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/pole/[poleNumber]",
      params: { poleNumber: "PAS-4938", scanned: "https://streetleaf.com/poles/pas-4938" },
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("ignores the burst of repeat reads the camera fires for one tag", async () => {
    await render(<ScanScreen />);
    await scan("PAS-1");
    await scan("PAS-1");
    await scan("PAS-2");
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("explains a code that isn't a pole tag, and keeps scanning", async () => {
    await render(<ScanScreen />);
    await scan("hello world");
    expect(await screen.findByText(/doesn't look like a pole number/)).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("error");
    expect(mockPush).not.toHaveBeenCalled();

    await scan("PAS-9");
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("opens a typed pole number without a scanned value", async () => {
    await render(<ScanScreen />);
    await fireEvent.changeText(screen.getByLabelText("Pole number"), " pas-77 ");
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/pole/[poleNumber]", params: { poleNumber: "PAS-77" } });
  });

  it("toggles the flashlight", async () => {
    await render(<ScanScreen />);
    expect(screen.getByTestId("scanner-camera").props.enableTorch).toBe(false);
    await fireEvent.press(screen.getByRole("switch", { name: "Flashlight" }));
    expect(screen.getByTestId("scanner-camera").props.enableTorch).toBe(true);
  });

  it("asks for camera access when it hasn't been granted", async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await render(<ScanScreen />);
    expect(screen.queryByTestId("scanner-camera")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Allow camera" }));
    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it("points to Settings once the OS won't ask again", async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await render(<ScanScreen />);
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
  });
});
