import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getCustomersMock, getSessionTokenMock } = vi.hoisted(() => ({
  getCustomersMock: vi.fn(),
  getSessionTokenMock: vi.fn().mockResolvedValue("jwt-token"),
}));

vi.mock("@/lib/apim", () => ({
  getCustomers: getCustomersMock,
}));

vi.mock("@/lib/session", () => ({
  getSessionToken: getSessionTokenMock,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import CustomersPage from "@/app/customers/page";

describe("CustomersPage", () => {
  it("calls getCustomers with active: true and the session token, so inactive customers don't show on the list", async () => {
    getCustomersMock.mockResolvedValue([]);

    await CustomersPage();

    expect(getCustomersMock).toHaveBeenCalledWith({ active: true }, "jwt-token");
  });

  it("renders the Customers page title and passes the fetched customers through", async () => {
    getCustomersMock.mockResolvedValue([
      {
        id: "r1",
        name: "Coastal Power & Light",
        projects: [],
        address: null,
        city: null,
        state: null,
        zip: null,
        phone: null,
        active: true,
        createdAt: "2026-01-01",
      },
    ]);

    const jsx = await CustomersPage();
    render(jsx);

    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByText("Coastal Power & Light")).toBeInTheDocument();
  });

  it("logs the fetched customers to the console via DebugLog, for inspecting the raw getCustomers result in DevTools", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customers = [
      {
        id: "r1",
        name: "Coastal Power & Light",
        projects: [],
        address: null,
        city: null,
        state: null,
        zip: null,
        phone: null,
        active: true,
      },
    ];
    getCustomersMock.mockResolvedValue(customers);

    const jsx = await CustomersPage();
    render(jsx);

    expect(consoleSpy).toHaveBeenCalledWith("[DebugLog] getCustomers result:", customers);
    consoleSpy.mockRestore();
  });
});
