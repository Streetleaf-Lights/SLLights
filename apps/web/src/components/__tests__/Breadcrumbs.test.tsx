import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs, customersCrumb, leadingCrumb, polesCrumb } from "@/components/Breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders each crumb's label", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Customers", href: "/customers" },
          { label: "Coastal Power & Light", href: "/customers/r2" },
          { label: "Bayou District Rebuild" },
        ]}
      />,
    );
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
    expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
  });

  it("renders items with an href as links", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Customers", href: "/customers" }, { label: "Not found" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Customers" });
    expect(link).toHaveAttribute("href", "/customers");
  });

  it("renders items without an href as plain text, not a link", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Customers", href: "/customers" }, { label: "Not found" }]}
      />,
    );
    expect(screen.queryByRole("link", { name: "Not found" })).not.toBeInTheDocument();
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("carries query strings in hrefs (e.g. ?cust_q=coastal)", () => {
    render(
      <Breadcrumbs
        items={[{ label: "Customers", href: "/customers?cust_q=coastal" }, { label: "Detail" }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Customers" })).toHaveAttribute(
      "href",
      "/customers?cust_q=coastal",
    );
  });

  it("filters out null entries (e.g. a hidden leading crumb) without rendering an empty slot or separator", () => {
    render(
      <Breadcrumbs
        items={[
          null,
          { label: "Coastal Power & Light", href: "/customers/r2" },
          { label: "Bayou District Rebuild" },
        ]}
      />,
    );
    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
    expect(screen.getByText("Bayou District Rebuild")).toBeInTheDocument();
    // The remaining first item should not carry a trailing separator meant
    // for a crumb before it that no longer exists, and there's exactly one
    // separator between the two remaining crumbs.
    expect(screen.getAllByText("/")).toHaveLength(1);
  });
});

describe("customersCrumb", () => {
  it("labels itself '← Customers' with no query", () => {
    expect(customersCrumb(undefined)).toEqual({
      label: "\u2190 Customers",
      href: "/customers",
    });
  });

  it("labels itself '← Customers' for an empty string query", () => {
    expect(customersCrumb("")).toEqual({ label: "\u2190 Customers", href: "/customers" });
  });

  it("swaps to a '← Customer Search' label when a query is active, and the href restores that same search", () => {
    expect(customersCrumb("coastal")).toEqual({
      label: "\u2190 Customer Search: \u201ccoastal\u201d",
      href: "/customers?cust_q=coastal",
    });
  });

  it("URL-encodes the query in the restored href", () => {
    expect(customersCrumb("coastal power")).toEqual({
      label: "\u2190 Customer Search: \u201ccoastal power\u201d",
      href: "/customers?cust_q=coastal%20power",
    });
  });
});

describe("polesCrumb", () => {
  it("labels itself '← Poles' with no query", () => {
    expect(polesCrumb(undefined)).toEqual({
      label: "\u2190 Poles",
      href: "/poles",
    });
  });

  it("swaps to a '← Pole Search' label when a query is active, and the href restores that same search", () => {
    expect(polesCrumb("12057")).toEqual({
      label: "\u2190 Pole Search: \u201c12057\u201d",
      href: "/poles?pole_q=12057",
    });
  });
});

describe("leadingCrumb", () => {
  it("shows the plain Customers crumb when neither search is active", () => {
    expect(leadingCrumb(undefined, undefined)).toEqual(customersCrumb(undefined));
  });

  it("shows the Customer Search crumb when only cust_q is active", () => {
    expect(leadingCrumb("coastal", undefined)).toEqual(customersCrumb("coastal"));
  });

  it("shows the Pole Search crumb when only pole_q is active", () => {
    expect(leadingCrumb(undefined, "12057")).toEqual(polesCrumb("12057"));
  });

  it("prioritizes the pole search when both cust_q and pole_q are active", () => {
    expect(leadingCrumb("coastal", "12057")).toEqual(polesCrumb("12057"));
  });

  it("hides the leading crumb entirely for a Customer Admin (no search active — would otherwise be the Customers crumb)", () => {
    expect(leadingCrumb(undefined, undefined, "Customer Admin")).toBeNull();
  });

  it("hides the leading crumb for a Customer Admin even with a customer search active", () => {
    expect(leadingCrumb("coastal", undefined, "Customer Admin")).toBeNull();
  });

  it("still shows the Poles crumb for a Customer Admin (they do have access to /poles)", () => {
    expect(leadingCrumb(undefined, "12057", "Customer Admin")).toEqual(polesCrumb("12057"));
  });

  it("still shows the Poles crumb for a Customer Admin even when a customer search is also active", () => {
    expect(leadingCrumb("coastal", "12057", "Customer Admin")).toEqual(polesCrumb("12057"));
  });

  it("shows the plain Customers crumb for any other role", () => {
    expect(leadingCrumb(undefined, undefined, "Streetleaf Admin")).toEqual(
      customersCrumb(undefined),
    );
  });

  it("shows the plain Customers crumb when role is null/undefined (not logged in / unknown)", () => {
    expect(leadingCrumb(undefined, undefined, null)).toEqual(customersCrumb(undefined));
    expect(leadingCrumb(undefined, undefined, undefined)).toEqual(customersCrumb(undefined));
  });
});
