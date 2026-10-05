import { Text } from "react-native";
import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react-native";
import WelcomeScreen from "../app/welcome";
import { IntroProvider, useIntro, WELCOME_DURATION_MS } from "@/intro/IntroProvider";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

/** Shows what the route guard in app/_layout.tsx would see. */
function IntroStatus() {
  const { done } = useIntro();
  return <Text testID="intro-status">{done ? "done" : "showing"}</Text>;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <IntroProvider>
      {children}
      <IntroStatus />
    </IntroProvider>
  );
}

describe("WelcomeScreen", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("introduces the app with the logo and what it's for, with no button", async () => {
    await render(<WelcomeScreen />, { wrapper: Wrapper });

    expect(screen.getByLabelText("Streetleaf")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Your solar street lights, wherever you are." })).toBeTruthy();
    for (const title of ["Monitor your lights", "Stay on top of issues", "Manage your lighting"]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/SLLights mobile/i)).toBeNull();
  });

  it("moves on by itself after five seconds, not before", async () => {
    await render(<WelcomeScreen />, { wrapper: Wrapper });
    expect(WELCOME_DURATION_MS).toBe(5000);

    await act(async () => {
      jest.advanceTimersByTime(WELCOME_DURATION_MS - 1);
    });
    expect(screen.getByTestId("intro-status")).toHaveTextContent("showing");

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("intro-status")).toHaveTextContent("done");
  });

  it("cancels its timer if it leaves the screen early", async () => {
    function Harness({ show }: { show: boolean }) {
      return <Wrapper>{show ? <WelcomeScreen /> : null}</Wrapper>;
    }
    const { rerender } = await render(<Harness show />);
    await rerender(<Harness show={false} />);

    await act(async () => {
      jest.advanceTimersByTime(WELCOME_DURATION_MS);
    });
    expect(screen.getByTestId("intro-status")).toHaveTextContent("showing");
  });

  it("stays put while EXPO_PUBLIC_HOLD_WELCOME=1 (dev review mode)", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_HOLD_WELCOME = "1";
    try {
      await render(<WelcomeScreen />, { wrapper: Wrapper });
      await act(async () => {
        jest.advanceTimersByTime(WELCOME_DURATION_MS * 3);
      });
      expect(screen.getByTestId("intro-status")).toHaveTextContent("showing");
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("EXPO_PUBLIC_HOLD_WELCOME"));
    } finally {
      delete process.env.EXPO_PUBLIC_HOLD_WELCOME;
      warn.mockRestore();
    }
  });
});
