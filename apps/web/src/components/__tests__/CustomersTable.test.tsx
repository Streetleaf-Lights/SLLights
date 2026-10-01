import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Customer } from "@/lib/types";

const { useSearchParamsMock } = vi.hoisted(() => ({ useSearchParamsMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
}));

import { CustomersTable, formatLocation } from "@/components/CustomersTable";

function makeCustomer(overrides: Partial<Customer> & { id: string; name: string }): Customer {
  return {
    projects: [],
    address: null,
    city: null,
    state: null,
    zip: null,
    phone: null,
    active: true,
    ...overrides,
  };
}

const emptySearchParams = new URLSearchParams();

describe("formatLocation", () => {
  it("joins city and state when both are present", () => {
    expect(
      formatLocation(makeCustomer({ id: "1", name: "A", city: "Tampa", state: "FL" })),
    ).toBe("Tampa, FL");
  });

  it("falls back to state only", () => {
    expect(formatLocation(makeCustomer({ id: "1", name: "A", state: "FL" }))).toBe("FL");
  });

  it("falls back to city only", () => {
    expect(formatLocation(makeCustomer({ id: "1", name: "A", city: "Tampa" }))).toBe("Tampa");
  });

  it("falls back to an em dash when both are missing", () => {
    expect(formatLocation(makeCustomer({ id: "1", name: "A" }))).toBe("—");
  });
});

describe("CustomersTable", () => {
  const customers: Customer[] = [
    makeCustomer({
      id: "r1",
      name: "15LightYears",
      state: "FL",
      projects: [],
    }),
    makeCustomer({
      id: "r2",
      name: "Coastal Power & Light",
      city: "New Orleans",
      state: "LA",
      phone: "504-555-0132",
      active: true,
      projects: [
        { id: "p1", name: "Bayou District Rebuild" },
        { id: "p2", name: "Storm Hardening Phase 2" },
      ],
    }),
    makeCustomer({
      id: "r3",
      name: "Highline Telecom Cooperative",
      city: "Minneapolis",
      state: "MN",
      projects: [{ id: "p3", name: "Fiber Overbuild North" }],
    }),
  ];

  it("renders a row per customer with name, project count, location, phone", () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    render(<CustomersTable customers={customers} />);

    expect(screen.getByRole("link", { name: "Coastal Power & Light" })).toBeInTheDocument();
    expect(screen.getByText("New Orleans, LA")).toBeInTheDocument();
    expect(screen.getByText("504-555-0132")).toBeInTheDocument();
  });

  it("does not show a loading spinner next to the customer link by default", () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    render(<CustomersTable customers={customers} />);

    expect(screen.queryByRole("status", { name: "Loading" })).not.toBeInTheDocument();
  });

  it("shows the total count in the toolbar", () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    render(<CustomersTable customers={customers} />);
    expect(screen.getByText("3 customers")).toBeInTheDocument();
  });

  it("filters by name as you type, case-insensitively", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    await user.type(screen.getByPlaceholderText("Search customers…"), "coastal");

    expect(screen.getByRole("link", { name: "Coastal Power & Light" })).toBeInTheDocument();
    expect(screen.queryByText("15LightYears")).not.toBeInTheDocument();
    expect(screen.getByText("1 customer")).toBeInTheDocument();
  });

  it("shows an empty state naming the query when nothing matches", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    await user.type(screen.getByPlaceholderText("Search customers…"), "zzz-no-match");

    expect(screen.getByText(/No customers match/)).toBeInTheDocument();
    expect(screen.getByText(/zzz-no-match/)).toBeInTheDocument();
  });

  it("seeds the search box from the ?cust_q= URL param", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("cust_q=coastal"));
    render(<CustomersTable customers={customers} />);

    expect(screen.getByPlaceholderText("Search customers…")).toHaveValue("coastal");
    expect(screen.getByRole("link", { name: "Coastal Power & Light" })).toBeInTheDocument();
    expect(screen.queryByText("15LightYears")).not.toBeInTheDocument();
  });

  it("expands a row to show its projects when clicked", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    expect(screen.queryByText("Bayou District Rebuild")).not.toBeInTheDocument();

    const row = screen.getByText("Coastal Power & Light").closest("tr")!;
    await user.click(row);

    expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
    expect(screen.getByText("Storm Hardening Phase 2")).toBeInTheDocument();
  });

  it("does not show the project id in the expanded projects sub-list", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    const row = screen.getByText("Coastal Power & Light").closest("tr")!;
    await user.click(row);

    expect(screen.queryByText("p1")).not.toBeInTheDocument();
    expect(screen.queryByText("p2")).not.toBeInTheDocument();
  });

  it("collapses an expanded row when clicked again", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    const row = screen.getByText("Coastal Power & Light").closest("tr")!;
    await user.click(row);
    expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();

    await user.click(row);
    expect(screen.queryByText("Bayou District Rebuild")).not.toBeInTheDocument();
  });

  it("shows a message when a customer has no projects", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    const row = screen.getByText("15LightYears").closest("tr")!;
    await user.click(row);

    expect(screen.getByText("No projects on file for this customer yet.")).toBeInTheDocument();
  });

  it("clicking the customer name link does not also toggle the row expand", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    await user.click(screen.getByRole("link", { name: "Coastal Power & Light" }));
    expect(screen.queryByText("Bayou District Rebuild")).not.toBeInTheDocument();
  });

  it("customer link carries the current search query as ?cust_q=", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    await user.type(screen.getByPlaceholderText("Search customers…"), "coastal");

    expect(screen.getByRole("link", { name: "Coastal Power & Light" })).toHaveAttribute(
      "href",
      "/customers/r2?cust_q=coastal",
    );
  });

  it("project link has no query param when the search box is empty", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const user = userEvent.setup();
    render(<CustomersTable customers={customers} />);

    const row = screen.getByText("Coastal Power & Light").closest("tr")!;
    await user.click(row);

    expect(screen.getByRole("link", { name: "Bayou District Rebuild" })).toHaveAttribute(
      "href",
      "/customers/r2/projects/p1",
    );
  });

  it("paginates at 10 rows per page", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const many: Customer[] = Array.from({ length: 25 }, (_, i) =>
      makeCustomer({ id: `c${i}`, name: `Customer ${i + 1}` }),
    );
    const user = userEvent.setup();
    render(<CustomersTable customers={many} />);

    // 10 data rows + 1 header row
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("Customer 1")).toBeInTheDocument();
    expect(screen.queryByText("Customer 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Customer 11")).toBeInTheDocument();
    expect(screen.queryByText("Customer 1")).not.toBeInTheDocument();
  });

  it("resets to page 1 when the search query changes", async () => {
    useSearchParamsMock.mockReturnValue(emptySearchParams);
    const many: Customer[] = Array.from({ length: 25 }, (_, i) =>
      makeCustomer({ id: `c${i}`, name: `Customer ${i + 1}` }),
    );
    const user = userEvent.setup();
    render(<CustomersTable customers={many} />);

    // Go to page 2 (shows Customer 11–20)
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Customer 11")).toBeInTheDocument();

    // "Customer 3" only matches the customer that lived on page 1 of the
    // unfiltered list. If it shows up, the page must have reset to 1.
    await user.type(screen.getByPlaceholderText("Search customers…"), "Customer 3");
    expect(screen.getByText("Customer 3")).toBeInTheDocument();
  });
});
