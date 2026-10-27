import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PAGER_ROW_BUDGET, Pagination, pagerRowWidth, pagerSizing } from "@/ui/Pagination";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const buttonStyle = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
const numberText = (n: number) => screen.getByText(String(n));

describe("Pagination with long page numbers", () => {
  it.each([
    [9, 36, 15],
    [999, 36, 15],
    [1521, 40, 13],
    [9999, 40, 13],
    [15210, 40, 11],
  ])("%p pages: %ppt buttons, %ppt numbers", (total, width, fontSize) => {
    expect(pagerSizing(total)).toEqual({ width, fontSize });
  });

  it.each([[9], [99], [999], [1521], [9999], [15210]])(
    "the fullest row for %p pages fits the narrowest common phone",
    (total) => {
      expect(pagerRowWidth(total)).toBeLessThanOrEqual(PAGER_ROW_BUDGET);
    },
  );

  it("shows 1521 in full: a wider button, smaller text, and shrink-to-fit as a safety net", async () => {
    await render(<Pagination page={760} totalPages={1521} onPageChange={jest.fn()} />);
    expect(buttonStyle("Page 1521").width).toBe(40);
    const last = numberText(1521);
    expect(StyleSheet.flatten(last.props.style).fontSize).toBe(13);
    expect(last.props.numberOfLines).toBe(1);
    expect(last.props.adjustsFontSizeToFit).toBe(true);
    // Every page number in the pager is the same width; the arrows stay square.
    for (const p of [1, 759, 760, 761]) expect(buttonStyle(`Page ${p}`).width).toBe(40);
    expect(buttonStyle("Next page").width).toBe(36);
  });

  it("keeps small pagers as they were", async () => {
    await render(<Pagination page={2} totalPages={9} onPageChange={jest.fn()} />);
    expect(buttonStyle("Page 9").width).toBe(36);
    expect(StyleSheet.flatten(numberText(9).props.style).fontSize).toBe(15);
  });

  it("still goes to the last page", async () => {
    const onPageChange = jest.fn();
    await render(<Pagination page={760} totalPages={1521} onPageChange={onPageChange} />);
    await fireEvent.press(screen.getByRole("button", { name: "Page 1521" }));
    expect(onPageChange).toHaveBeenCalledWith(1521);
  });
});
