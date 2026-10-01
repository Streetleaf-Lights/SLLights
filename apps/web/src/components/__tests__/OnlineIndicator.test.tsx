import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnlineIndicator } from "@/components/OnlineIndicator";

describe("OnlineIndicator", () => {
  it("shows green 'Online' with a dot when isOnline is true", () => {
    render(<OnlineIndicator isOnline={true} />);
    const el = screen.getByText("Online");
    expect(el.className).toContain("text-[var(--status-active)]");
    expect(el.querySelector("span[aria-hidden]")).toBeTruthy();
  });

  it("shows red 'Offline' with a dot when isOnline is false", () => {
    render(<OnlineIndicator isOnline={false} />);
    const el = screen.getByText("Offline");
    expect(el.className).toContain("text-[var(--status-flagged)]");
    expect(el.querySelector("span[aria-hidden]")).toBeTruthy();
  });

  it("shows a neutral dash with no dot when isOnline is null", () => {
    render(<OnlineIndicator isOnline={null} />);
    const el = screen.getByText("—");
    expect(el.className).toContain("text-[var(--ink-faint)]");
    expect(el.querySelector("span[aria-hidden]")).toBeNull();
  });
});
