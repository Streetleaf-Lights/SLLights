import { fireEvent, render, screen } from "@testing-library/react-native";
import HomeTab from "../app/(tabs)/index";
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

describe("ProjectDetailView", () => {
  it("lists poles with 48h status and connection for staff, and opens a pole", async () => {
    await signIn("Streetleaf Admin", null);
    const onLoaded = jest.fn();
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped={false} onLoaded={onLoaded} />, {
      wrapper: withSignedInAuth(api),
    });

    expect(await screen.findByText("3 poles")).toBeTruthy();
    expect(onLoaded).toHaveBeenCalledWith("North Corridor");
    expect(api.getProject).toHaveBeenCalledWith("c1", "p1");
    expect(screen.getByLabelText("Connected: 2")).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Pole PAS-2, 48 hour overall status Fault, Connected Offline, 2 open issues",
      }),
    ).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: /^Pole PAS-10/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/pole/[poleNumber]", params: { poleNumber: "PAS-10" } });
  });

  it("drops the 48h prefix and Connected for customer-scoped viewers", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped />, { wrapper: withSignedInAuth(api) });

    expect(await screen.findByRole("button", { name: "Pole PAS-2, Overall status Fault, 2 open issues" })).toBeTruthy();
    expect(screen.queryByLabelText(/^Connected:/)).toBeNull();
    expect(screen.getByLabelText("Lights working: 66.7%")).toBeTruthy();
  });

  it("filters poles by number", async () => {
    await signIn("Customer Owner", "c1");
    const api = fakeApi({ getProject: jest.fn().mockResolvedValue(project) });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped />, { wrapper: withSignedInAuth(api) });
    await screen.findByText("3 poles");

    await fireEvent.changeText(screen.getByLabelText("Search pole numbers"), "pas-1");
    expect(screen.getByText("2 poles matching “pas-1”")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Search pole numbers"), "zzz");
    expect(screen.getByText("No poles match that number.")).toBeTruthy();
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
