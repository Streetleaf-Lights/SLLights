import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/PageHeader";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Customers" />);
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<PageHeader title="Customers" description="Accounts at the top." />);
    expect(screen.getByText("Accounts at the top.")).toBeInTheDocument();
  });

  it("omits the description when not provided", () => {
    render(<PageHeader title="Customers" />);
    expect(screen.queryByText(/accounts/i)).not.toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<PageHeader title="Customers" actions={<button type="button">Add</button>} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
