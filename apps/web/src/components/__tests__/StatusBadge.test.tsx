import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["active", "Active"],
    ["inactive", "Inactive"],
    ["pending", "Pending"],
    ["planned", "Planned"],
    ["decommissioned", "Decommissioned"],
    ["flagged", "Flagged"],
    ["admin", "Admin"],
    ["editor", "Editor"],
    ["viewer", "Viewer"],
  ] as const)("renders the %s status with label %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
