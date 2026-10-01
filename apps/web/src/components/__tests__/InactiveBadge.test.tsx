import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { InactiveBadge } from "@/components/InactiveBadge";

describe("InactiveBadge", () => {
  it("renders the text '(Inactive)'", () => {
    render(<InactiveBadge />);
    expect(screen.getByText("(Inactive)")).toBeInTheDocument();
  });

  it("uses the warning (orange) color token", () => {
    render(<InactiveBadge />);
    expect(screen.getByText("(Inactive)").className).toContain(
      "text-[var(--status-warning)]",
    );
  });
});
