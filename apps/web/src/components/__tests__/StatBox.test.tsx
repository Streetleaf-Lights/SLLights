import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatBox } from "@/components/StatBox";

describe("StatBox", () => {
  it("renders the value and label", () => {
    render(<StatBox value={14} label="Total lights" />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("Total lights")).toBeInTheDocument();
  });

  it("renders a string value (e.g. a stub placeholder)", () => {
    render(<StatBox value="—" label="Lights working" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("sets an aria-label combining value and label", () => {
    render(<StatBox value={4} label="Total lights" />);
    expect(screen.getByLabelText("4 Total lights")).toBeInTheDocument();
  });

  it("defaults to the large size", () => {
    render(<StatBox value={4} label="Total lights" />);
    expect(screen.getByText("4").className).toContain("text-[20px]");
  });

  it("uses smaller styles when size='sm'", () => {
    render(<StatBox value={4} label="Total lights" size="sm" />);
    expect(screen.getByText("4").className).toContain("text-[13px]");
  });
});
