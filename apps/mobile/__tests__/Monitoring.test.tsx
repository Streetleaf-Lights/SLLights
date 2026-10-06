import { act, fireEvent, render, screen } from "@testing-library/react-native";
import HomeTab from "../app/(tabs)/(home)/index";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { CustomerListView } from "@/monitoring/CustomerListView";
import { CustomerOverviewView } from "@/monitoring/CustomerOverviewView";
import { ProjectDetailView } from "@/monitoring/ProjectDetailView";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const overview = {
  customer: { id: "c1", name: "Coastal Power", addressLine: "1 Main St, Tampa, FL 33602", phone: "555-0100", active: true },
  summary: { totalLights: 120, connectedLights: 110, totalFaults: 3, percentWorking: 97.52 },
  projects: [
    { id: "p1", name: "North Corridor", active: true, totalLights: 80, connectedLights: 75, totalFaults: 2, percentWorking: 97 },
    { id: "p2", name: "Harbor Park", active: false, totalLights: null, connectedLights: null, totalFaults: null, percentWorking: null },
  ],
};

const project = {
  customer: { id: "c1", name: "Coastal Power" },
  project: { id: "p1", name: "North Corridor", active: true, totalLights: 3, connectedLights: 2, totalFaults: 1, percentWorking: 66.7 },
  poles: [
    { id: "a", poleNumber: "PAS-1", connectedText: "Online", overallStatusText: "OK", lastUpdate: "2026-10-01 12:00:00+00:00", openIssues: 0 },
    { id: "b", poleNumber: "PAS-2", connectedText: "Offline", overallStatusText: "Fault", lastUpdate: null, openIssues: 2 },
    { id: "c", poleNumber: "PAS-10", connectedText: null, overallStatusText: null, lastUpdate: null, openIssues: 1 },
  ],
};

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

beforeEach(() => mockPush.mockClear());

// FlatList (VirtualizedList) renders rows in batches on timers. With real
// timers a busy machine can fire one outside act() (a warning that would
// hide real ones), so these tests use fake timers and flush what's pending
// inside act() before cleanup. RNTL advances fake timers itself while
// findBy*/waitFor are waiting.
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("CustomerOverviewView", () => {
  it("shows the customer header, summary and projects, and opens a project", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({ getCustomerOverview: jest.fn().mockResolvedValue(overview) });
    await render(<CustomerOverviewView customerId="c1" viewerScoped={false} />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByText("Coastal Power")).toBeTruthy();
    expect(screen.getByText("1 Main St, Tampa, FL 33602")).toBeTruthy();
    expect(screen.getByLabelText("Total lights: 120")).toBeTruthy();
    expect(screen.getByLabelText("Lights working: 97.5%")).toBeTruthy();
    expect(screen.getByLabelText("Total faults: 3")).toBeTruthy();
    expect(screen.getByText("2 projects")).toBeTruthy();
    // Staff see Connected on project rows; missing vitals show as a dash.
    expect(screen.getByLabelText("Connected: 75")).toBeTruthy();
    expect(screen.getAllByLabelText("Lights: —")).toHaveLength(1);

    await fireEvent.press(screen.getByRole("button", { name: /^North Corridor/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/project/[customerId]/[projectId]",
      params: { customerId: "c1", projectId: "p1" },
    });
  });

  it("hides Connected for customer-scoped viewers, as the web does", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ getCustomerOverview: jest.fn().mockResolvedValue(overview) });
    await render(<CustomerOverviewView customerId="c1" viewerScoped />, { wrapper: withSignedInAuth(api) });
    await screen.findByText("Coastal Power");
    expect(screen.queryByLabelText(/^Connected:/)).toBeNull();
  });

  it("offers a retry when loading fails", async () => {
    await signIn("Customer Owner", "c1");
    const getCustomerOverview = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("No connection. Check your signal and try again.", null))
      .mockResolvedValueOnce(overview);
    await render(<CustomerOverviewView customerId="c1" viewerScoped />, {
      wrapper: withSignedInAuth(fakeApi({ getCustomerOverview })),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Coastal Power")).toBeTruthy();
  });
});

describe("CustomerListView", () => {
  it("searches customers by name and opens one", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({
      listCustomers: jest.fn().mockResolvedValue({
        customers: [
          { id: "c1", name: "Coastal Power" },
          { id: "c2", name: "Harbor City" },
        ],
      }),
    });
    await render(<CustomerListView />, { wrapper: withSignedInAuth(api) });
    expect(await screen.findByText("2 customers")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Search customers"), "harbor");
    expect(screen.queryByText("Coastal Power")).toBeNull();
    expect(screen.getByText("1 customer")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Harbor City" }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/customer/[customerId]", params: { customerId: "c2" } });
  });
});

describe("CustomerListView pagination", () => {
  // n customers named "Customer 01".. (zero-padded so they sort in order).
  const customersOf = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const id = String(i + 1).padStart(2, "0");
      return { id: `c${id}`, name: `Customer ${id}` };
    });

  async function renderList(n: number) {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({ listCustomers: jest.fn().mockResolvedValue({ customers: customersOf(n) }) });
    await render(<CustomerListView />, { wrapper: withSignedInAuth(api) });
    await screen.findByText(`Showing 1–10 of ${n} customers`);
  }

  const pageButton = (p: number) => screen.getByRole("button", { name: `Page ${p}` });
  const pageNumbers = () =>
    screen.getAllByRole("button", { name: /^Page \d+$/ }).map((b) => Number(b.props.accessibilityLabel.slice(5)));
  // The "…" is hidden from screen readers on purpose, so include hidden elements.
  /** The pager row in on-screen order, as compact text: "1 ‹ … 4 5 6 … › 9". */
  const pagerRow = () =>
    screen
      .getAllByRole("button", { name: /^(Page \d+|Previous page|Next page)$/ })
      .map((b) => {
        const label: string = b.props.accessibilityLabel;
        return label === "Previous page" ? "‹" : label === "Next page" ? "›" : label.slice(5);
      })
      .join(" ");
  const gaps = () => screen.queryAllByTestId("pager-gap", { includeHiddenElements: true }).length;

  it("shows 10 per page with arrow-only Previous/Next and numbered pages", async () => {
    await renderList(23);
    expect(screen.getByText("Customer 10")).toBeTruthy();
    expect(screen.queryByText("Customer 11")).toBeNull();
    expect(pageNumbers()).toEqual([1, 2, 3]);
    expect(pageButton(1).props.accessibilityState.selected).toBe(true);
    expect(gaps()).toBe(0);
    // Arrows only: no visible "Previous"/"Next" or "Page x of y" text.
    expect(screen.queryByText(/^(Previous|Next)$/)).toBeNull();
    expect(screen.queryByText(/^Page \d+ of/)).toBeNull();
    expect(screen.getByRole("button", { name: "Previous page" }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11–20 of 23 customers")).toBeTruthy();
    expect(screen.getByText("Customer 11")).toBeTruthy();
    expect(pageButton(2).props.accessibilityState.selected).toBe(true);

    await fireEvent.press(pageButton(3));
    expect(screen.getByText("Customer 23")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" }).props.accessibilityState.disabled).toBe(true);
  });

  it("puts the first and last page outside the arrows, like the web, only when needed", async () => {
    await renderList(57); // 6 pages
    expect(pagerRow()).toBe("‹ 1 2 3 › 6"); // plus a trailing …
    expect(gaps()).toBe(1);

    await fireEvent.press(pageButton(3)); // window 2 3 4: 1 is right next to it, so no leading …
    expect(pagerRow()).toBe("1 ‹ 2 3 4 › 6");
    expect(gaps()).toBe(1);

    await fireEvent.press(pageButton(6)); // jump straight to the last page
    expect(screen.getByText("Showing 51–57 of 57 customers")).toBeTruthy();
    expect(pagerRow()).toBe("1 ‹ 4 5 6 ›");
    expect(gaps()).toBe(1);
  });


  it("shows … on both sides in the middle of a long list, and jumps to page 1", async () => {
    await renderList(90); // 9 pages
    await fireEvent.press(pageButton(3));
    await fireEvent.press(pageButton(4));
    expect(pagerRow()).toBe("1 ‹ 3 4 5 › 9"); // 1 ‹ … 3 4 5 … › 9
    expect(gaps()).toBe(2);

    await fireEvent.press(pageButton(1));
    expect(screen.getByText("Showing 1–10 of 90 customers")).toBeTruthy();
    expect(pagerRow()).toBe("‹ 1 2 3 › 9");
  });


  it("sits above the list, right under the Showing line", async () => {
    await renderList(23);
    // Walk the rendered tree top-to-bottom, collecting text and button labels in order.
    type Node = { props?: Record<string, unknown>; children?: (Node | string)[] | null } | string | null;
    const order: string[] = [];
    const walk = (node: Node | Node[]) => {
      if (!node) return;
      if (Array.isArray(node)) return node.forEach(walk);
      if (typeof node === "string") return void order.push(node);
      const label = node.props?.accessibilityLabel;
      if (typeof label === "string") order.push(label);
      (node.children ?? []).forEach(walk);
    };
    walk(screen.toJSON() as Node);

    const showing = order.indexOf("Showing 1–10 of 23 customers");
    const pager = order.indexOf("Next page");
    const firstRow = order.indexOf("Customer 01");
    expect(showing).toBeGreaterThanOrEqual(0);
    expect(showing).toBeLessThan(pager);
    expect(pager).toBeLessThan(firstRow);
  });


  it("goes back to page 1 when the search changes, and hides paging when one page is enough", async () => {
    await renderList(23);
    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    expect(pageButton(2).props.accessibilityState.selected).toBe(true);

    // "1" matches 01, 10–19 and 21 → 12 results → still two pages, but back on page 1.
    await fireEvent.changeText(screen.getByLabelText("Search customers"), "1");
    expect(screen.getByText("Showing 1–10 of 12 customers")).toBeTruthy();
    expect(pageButton(1).props.accessibilityState.selected).toBe(true);

    await fireEvent.changeText(screen.getByLabelText("Search customers"), "customer 2");
    expect(screen.getByText("4 customers")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Page \d+$/ })).toBeNull();
  });
});

describe("ProjectDetailView", () => {
  it("lists poles with 48h status and connection for staff, and opens a pole", async () => {
    await signIn("Streetleaf Admin", null);
    const onLoaded = jest.fn();
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped={false} onLoaded={onLoaded} />, {
      wrapper: withSignedInAuth(api),
    });

    expect(await screen.findByText("3 poles")).toBeTruthy();
    expect(onLoaded).toHaveBeenCalledWith(project);
    expect(api.getProject).toHaveBeenCalledWith("c1", "p1");
    expect(screen.getByLabelText("Connected: 2")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Pole PAS-2, 48 hour overall status Fault, Connected Offline, 2 open issues",
      }),
    ).toBeTruthy();

    // Rows show status and connection only — no "Updated …" line.
    expect(screen.queryByText(/^Updated /)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: /^Pole PAS-10/ }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/project/[customerId]/[projectId]/pole/[poleId]",
      params: { customerId: "c1", projectId: "p1", poleId: "c" },
    });
  });

  it("drops the 48h prefix, Connected and Lights working for customer-scoped viewers", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByRole("button", { name: "Pole PAS-2, Overall status Fault, 2 open issues" })).toBeTruthy();
    // Just Total lights and Total faults for customer-scoped viewers.
    expect(screen.getByLabelText("Total lights: 3")).toBeTruthy();
    expect(screen.getByLabelText("Total faults: 1")).toBeTruthy();
    expect(screen.queryByLabelText(/^Connected:/)).toBeNull();
    expect(screen.queryByLabelText(/^Lights working:/)).toBeNull();
  });

  it("has no search box", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped />, { wrapper: withSignedInAuth(api) });
    await screen.findByText("3 poles");
    expect(screen.queryByLabelText("Search pole numbers")).toBeNull();
    // Everything fits on one page, so no pager either.
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("pages poles 10 at a time, with the pager under the Showing line", async () => {
    await signIn("Streetleaf Admin", null);
    const manyPoles = Array.from({ length: 57 }, (_, i) => ({
      id: `id${i + 1}`,
      poleNumber: `PAS-${i + 1}`,
      connectedText: "Online",
      overallStatusText: "OK",
      lastUpdate: null,
      openIssues: 0,
    }));
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue({ ...project, poles: manyPoles }) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped={false} />, {
      wrapper: withSignedInAuth(api),
    });

    expect(await screen.findByText("Showing 1–10 of 57 poles")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Pole PAS-10,/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Pole PAS-11,/ })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Showing 11–20 of 57 poles")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Pole PAS-11,/ })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Page 6" })); // the last page, outside ›
    expect(screen.getByText("Showing 51–57 of 57 poles")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Pole PAS-57,/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next page" }).props.accessibilityState.disabled).toBe(true);
  });

});

describe("HomeTab", () => {
  it("shows a customer their own overview", async () => {
    await signIn("Customer Admin", "c1");
    const api = fakeApi({ getCustomerOverview: jest.fn().mockResolvedValue(overview) });
    await render(<HomeTab />, { wrapper: withSignedInAuth(api) });
    expect(await screen.findByText("Coastal Power")).toBeTruthy();
    expect(api.getCustomerOverview).toHaveBeenCalledWith("c1");
    expect(api.listCustomers).not.toHaveBeenCalled();
  });

  it("shows Streetleaf staff the customer list", async () => {
    await signIn("Streetleaf Admin", null);
    const api = fakeApi({ listCustomers: jest.fn().mockResolvedValue({ customers: [] }) });
    await render(<HomeTab />, { wrapper: withSignedInAuth(api) });
    expect(await screen.findByText("0 customers")).toBeTruthy();
    expect(api.getCustomerOverview).not.toHaveBeenCalled();
  });
});
