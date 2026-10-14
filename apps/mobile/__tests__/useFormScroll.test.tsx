import { Keyboard, Platform } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { ANDROID_KEYBOARD_LAYOUT_DELAY_MS, useFormScroll } from "@/installs/useFormScroll";

let keyboardDidShow: () => void = () => undefined;
const scrollView = { scrollTo: jest.fn(), scrollToEnd: jest.fn() };

// Only this file's own spies are undone afterwards (restoreAllMocks would also undo the shared setup's).
let spies: jest.SpyInstance[] = [];
let isVisible: jest.SpyInstance;
beforeEach(() => {
  isVisible = jest.spyOn(Keyboard, "isVisible").mockReturnValue(false);
  spies = [
    jest.spyOn(Keyboard, "addListener").mockImplementation((_event, listener) => {
      keyboardDidShow = listener as () => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
    }),
    isVisible,
    jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined),
  ];
  scrollView.scrollTo.mockClear();
  scrollView.scrollToEnd.mockClear();
});
afterEach(() => spies.forEach((spy) => spy.mockRestore()));

async function setup() {
  const hook = await renderHook(() => useFormScroll());
  // Stand in for the screen's scroll view.
  (hook.result.current.scrollRef as { current: unknown }).current = scrollView;
  return hook;
}

describe("useFormScroll", () => {
  it("scrolls Notes (and Submit) into view once the keyboard is up", async () => {
    const { result } = await setup();
    await act(async () => result.current.bottomFieldProps.onFocus());
    expect(scrollView.scrollToEnd).not.toHaveBeenCalled(); // keyboard not up yet
    await act(async () => keyboardDidShow());
    expect(scrollView.scrollToEnd).toHaveBeenCalledWith({ animated: true });
  });

  it("scrolls straight away when moving to Notes with the keyboard already open", async () => {
    isVisible.mockReturnValue(true);
    const { result } = await setup();
    await act(async () => result.current.bottomFieldProps.onFocus());
    expect(scrollView.scrollToEnd).toHaveBeenCalledTimes(1);
  });

  it("doesn't scroll for the keyboard of other fields", async () => {
    const { result } = await setup();
    await act(async () => result.current.bottomFieldProps.onFocus());
    await act(async () => result.current.bottomFieldProps.onBlur());
    await act(async () => keyboardDidShow()); // e.g. typing a serial number
    expect(scrollView.scrollToEnd).not.toHaveBeenCalled();
  });

  it("showTop closes the keyboard and scrolls to the top", async () => {
    const { result } = await setup();
    await act(async () => result.current.showTop());
    expect(Keyboard.dismiss).toHaveBeenCalled();
    expect(scrollView.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  describe("on Android", () => {
    const originalOS = Platform.OS;
    const setOS = (os: "ios" | "android") => Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
    beforeEach(() => {
      setOS("android");
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
      setOS(originalOS as "ios" | "android");
    });

    it("waits for the room made for the keyboard to be laid out, then scrolls once", async () => {
      const { result } = await setup();
      await act(async () => result.current.bottomFieldProps.onFocus());
      await act(async () => keyboardDidShow());
      expect(scrollView.scrollToEnd).not.toHaveBeenCalled(); // not into the old layout
      await act(async () => {
        jest.advanceTimersByTime(ANDROID_KEYBOARD_LAYOUT_DELAY_MS);
      });
      expect(scrollView.scrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("doesn't scroll after the screen has closed", async () => {
      const { result, unmount } = await setup();
      await act(async () => result.current.bottomFieldProps.onFocus());
      await act(async () => keyboardDidShow());
      await unmount();
      jest.advanceTimersByTime(ANDROID_KEYBOARD_LAYOUT_DELAY_MS);
      expect(scrollView.scrollToEnd).not.toHaveBeenCalled();
    });
  });
});
