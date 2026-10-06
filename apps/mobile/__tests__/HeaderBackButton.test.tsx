import { fireEvent, render, screen } from "@testing-library/react-native";
import { HeaderBackButton } from "@/ui/HeaderBackButton";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

describe("HeaderBackButton", () => {
  it("shows the arrow with the name it returns to, and goes back when pressed", async () => {
    const onPress = jest.fn();
    await render(<HeaderBackButton label="North Corridor" onPress={onPress} />);
    expect(screen.getByText("North Corridor")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back to North Corridor" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("truncates a long name to one line instead of dropping it", async () => {
    await render(<HeaderBackButton label="A Very Long Project Name That Will Not Fit In The Bar" onPress={jest.fn()} />);
    const label = screen.getByText("A Very Long Project Name That Will Not Fit In The Bar");
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe("tail");
  });

  it("is a plain arrow (announced as Back) before the name is known", async () => {
    await render(<HeaderBackButton onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
