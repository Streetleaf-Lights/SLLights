import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination, getPageWindow } from "@/components/Pagination";

describe("getPageWindow", () => {
  it("returns all pages when total is less than the window size", () => {
    expect(getPageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("centers the window around the current page", () => {
    expect(getPageWindow(6, 12)).toEqual([4, 5, 6, 7, 8]);
  });

  it("clamps the window to the start when current page is near 1", () => {
    expect(getPageWindow(1, 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it("clamps the window to the end when current page is near the last page", () => {
    expect(getPageWindow(20, 20)).toEqual([16, 17, 18, 19, 20]);
  });

  it("respects a custom window size", () => {
    expect(getPageWindow(5, 20, 3)).toEqual([4, 5, 6]);
  });

  it("returns a single page when total is 1", () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
  });
});

describe("Pagination component", () => {
  it("disables First/Previous on the first page", () => {
    render(<Pagination page={1} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /first/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /last/i })).toBeEnabled();
  });

  it("disables Next/Last on the last page", () => {
    render(<Pagination page={5} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /last/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /first/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /previous/i })).toBeEnabled();
  });

  it("shows no ellipsis when every page fits in the window", () => {
    render(<Pagination page={3} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("shows only a trailing ellipsis near the start of a long list", () => {
    render(<Pagination page={1} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText("…")).toHaveLength(1);
  });

  it("shows only a leading ellipsis near the end of a long list", () => {
    render(<Pagination page={20} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText("…")).toHaveLength(1);
  });

  it("shows both ellipses in the middle of a long list", () => {
    render(<Pagination page={10} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("calls onPageChange with the clicked page number", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("calls onPageChange(1) when First is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={4} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /first/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange(totalPages) when Last is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={7} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /last/i }));
    expect(onPageChange).toHaveBeenCalledWith(7);
  });

  it("calls onPageChange(page - 1) / (page + 1) for Previous/Next", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});
