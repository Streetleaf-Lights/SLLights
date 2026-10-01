import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const { useLinkStatusMock } = vi.hoisted(() => ({ useLinkStatusMock: vi.fn() }));

vi.mock("next/link", () => ({
  useLinkStatus: useLinkStatusMock,
}));

import { NavLinkSpinner } from "@/components/NavLinkSpinner";

describe("NavLinkSpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing immediately when pending", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    render(<NavLinkSpinner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing while not pending", () => {
    useLinkStatusMock.mockReturnValue({ pending: false });
    render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still renders nothing just before the 2s mark", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(1999));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the spinner once pending has lasted 2s", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("defaults to the sidebar's styling when no className is given", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toHaveClass(
      "ml-auto",
      "text-[var(--sidebar-accent-strong)]",
    );
  });

  it("uses a custom className when given, for reuse outside the sidebar", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    render(<NavLinkSpinner className="text-[var(--ink-faint)]" />);

    act(() => vi.advanceTimersByTime(2000));
    const status = screen.getByRole("status");
    expect(status).toHaveClass("text-[var(--ink-faint)]");
    expect(status).not.toHaveClass("ml-auto");
  });

  it("never shows the spinner if pending resolves before 2s", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    const { rerender } = render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(1000));
    useLinkStatusMock.mockReturnValue({ pending: false });
    rerender(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("hides the spinner immediately once pending resolves after showing", () => {
    useLinkStatusMock.mockReturnValue({ pending: true });
    const { rerender } = render(<NavLinkSpinner />);

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("status")).toBeInTheDocument();

    useLinkStatusMock.mockReturnValue({ pending: false });
    rerender(<NavLinkSpinner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
