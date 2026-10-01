import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { DebugLog } from "@/components/DebugLog";

describe("DebugLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the label and data to the console on mount", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<DebugLog label="getCustomers result" data={[{ id: "1" }]} />);

    expect(consoleSpy).toHaveBeenCalledWith("[DebugLog] getCustomers result:", [{ id: "1" }]);
  });

  it("renders nothing", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { container } = render(<DebugLog label="test" data={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("logs only once, even if it re-renders with different data", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { rerender } = render(<DebugLog label="test" data={{ count: 1 }} />);
    rerender(<DebugLog label="test" data={{ count: 2 }} />);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("[DebugLog] test:", { count: 1 });
  });

  it("logs whatever value is passed, including null, undefined, and primitives", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    render(<DebugLog label="nothing found" data={undefined} />);

    expect(consoleSpy).toHaveBeenCalledWith("[DebugLog] nothing found:", undefined);
  });
});
