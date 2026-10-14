import { Platform, StatusBar } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { modalSystemBars, useModalSafeArea } from "@/ui/modalSafeArea";

let mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => mockInsets }));

const originalOS = Platform.OS;
const setOS = (os: "ios" | "android") => Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
const originalHeight = StatusBar.currentHeight;
afterEach(() => {
  setOS(originalOS as "ios" | "android");
  StatusBar.currentHeight = originalHeight;
  mockInsets = { top: 59, bottom: 34, left: 0, right: 0 };
});

describe("useModalSafeArea", () => {
  it("iOS: pads by the app's insets", async () => {
    setOS("ios");
    const { result } = await renderHook(() => useModalSafeArea());
    expect(result.current).toEqual({ paddingTop: 59, paddingBottom: 34, paddingLeft: 0, paddingRight: 0 });
  });

  it("Android: never less than the system's status bar, even when the app's inset says 0", async () => {
    setOS("android");
    StatusBar.currentHeight = 32;
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
    const { result } = await renderHook(() => useModalSafeArea());
    expect(result.current.paddingTop).toBe(32);
  });

  it("Android: uses the app's inset when it's the larger (e.g. a display cutout)", async () => {
    setOS("android");
    StatusBar.currentHeight = 24;
    mockInsets = { top: 40, bottom: 0, left: 0, right: 0 };
    const { result } = await renderHook(() => useModalSafeArea());
    expect(result.current.paddingTop).toBe(40);
  });

  it("draws under the status bar only (Android keeps the navigation bar clear itself)", () => {
    expect(modalSystemBars).toEqual({ statusBarTranslucent: true });
  });
});
