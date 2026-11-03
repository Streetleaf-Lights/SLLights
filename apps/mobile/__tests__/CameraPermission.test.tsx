import { Linking } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BarcodeScannerModal } from "@/scan/BarcodeScannerModal";

/**
 * Apple guideline 5.1.1(iv): the screen before the system's camera prompt must
 * not push people to allow it — a neutral "Continue", never "Allow".
 */
const mockPermission: { value: { granted: boolean; canAskAgain: boolean } } = { value: { granted: false, canAskAgain: true } };
const mockRequest = jest.fn();
jest.mock("expo-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    CameraView: (props: Record<string, unknown>) => <View {...props} />,
    useCameraPermissions: () => [mockPermission.value, mockRequest],
  };
});
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

const open = () => render(<BarcodeScannerModal visible title="Scan Solar Panel Serial Number" onScanned={jest.fn()} onClose={jest.fn()} />);
const allText = () => JSON.stringify(screen.toJSON());

afterEach(() => {
  mockRequest.mockReset();
  jest.restoreAllMocks();
});

describe("camera permission (before the system prompt)", () => {
  it("not asked yet: explains neutrally, with 'Continue' — never 'Allow'", async () => {
    mockPermission.value = { granted: false, canAskAgain: true };
    await open();
    expect(screen.getByText("Scan with the camera")).toBeTruthy();
    expect(screen.getByText(/You can also close this and type the serial number instead/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockRequest).toHaveBeenCalledTimes(1); // the system's own prompt
    expect(allText()).not.toMatch(/\ballow\b/i);
  });

  it("declined before: points to Settings, and to typing instead", async () => {
    mockPermission.value = { granted: false, canAskAgain: false };
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    await open();
    expect(screen.getByText("Camera access is off")).toBeTruthy();
    expect(screen.getByText(/turn on camera access for Streetleaf Lights in Settings/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Open Settings" }));
    expect(settings).toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
    expect(allText()).not.toMatch(/\ballow\b/i);
  });

  it("allowed: straight to scanning", async () => {
    mockPermission.value = { granted: true, canAskAgain: true };
    await open();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.getByText("Line up one barcode inside the frame")).toBeTruthy();
  });
});
