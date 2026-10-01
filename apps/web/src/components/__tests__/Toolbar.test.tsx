import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimaryButton, StubNotice, Toolbar } from "@/components/Toolbar";

describe("Toolbar", () => {
  it("renders a disabled input when no value/onChange is provided", () => {
    render(<Toolbar searchPlaceholder="Search things…" />);
    expect(screen.getByPlaceholderText("Search things…")).toBeDisabled();
  });

  it("renders an enabled, controlled input when value/onChange are provided", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Toolbar searchPlaceholder="Search things…" value="abc" onChange={onChange} />,
    );

    const input = screen.getByPlaceholderText("Search things…");
    expect(input).toBeEnabled();
    expect(input).toHaveValue("abc");

    await user.type(input, "d");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the result count when provided", () => {
    render(<Toolbar searchPlaceholder="Search…" resultCount="3 customers" />);
    expect(screen.getByText("3 customers")).toBeInTheDocument();
  });

  it("omits the result count when not provided", () => {
    render(<Toolbar searchPlaceholder="Search…" />);
    expect(screen.queryByText(/customers/)).not.toBeInTheDocument();
  });

  it("renders children (e.g. filter chips) alongside the search box", () => {
    render(
      <Toolbar searchPlaceholder="Search…">
        <button type="button">Filter chip</button>
      </Toolbar>,
    );
    expect(screen.getByRole("button", { name: "Filter chip" })).toBeInTheDocument();
  });
});

describe("PrimaryButton", () => {
  it("renders disabled with the given label", () => {
    render(<PrimaryButton>Add customer</PrimaryButton>);
    const button = screen.getByRole("button", { name: "Add customer" });
    expect(button).toBeDisabled();
  });
});

describe("StubNotice", () => {
  it("renders its children", () => {
    render(<StubNotice>This is a stub.</StubNotice>);
    expect(screen.getByText("This is a stub.")).toBeInTheDocument();
  });
});
