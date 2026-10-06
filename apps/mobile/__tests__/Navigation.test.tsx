import { Stack } from "expo-router";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter as renderRouterSync } from "expo-router/testing-library";
import * as TabsLayout from "../app/(tabs)/_layout";
import * as Account from "../app/(tabs)/account";
import * as HomeLayout from "../app/(tabs)/(home)/_layout";
import * as HomeIndex from "../app/(tabs)/(home)/index";
import * as Customer from "../app/(tabs)/(home)/customer/[customerId]";
import * as Project from "../app/(tabs)/(home)/project/[customerId]/[projectId]";
import * as ProjectPole from "../app/(tabs)/(home)/project/[customerId]/[projectId]/pole/[poleId]";
import * as ScanLayout from "../app/(tabs)/(scan)/_layout";
import * as Scan from "../app/(tabs)/(scan)/scan";
import * as Pole from "../app/(tabs)/(home,scan)/pole/[poleNumber]";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makePoleDetail, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-camera", () => {
  const { View } = jest.requireActual("react-native");
  return {
    CameraView: (props: Record<string, unknown>) => <View {...props} />,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

/**
 * expo-router's renderRouter calls Testing Library's render without awaiting
 * it — fine for RNTL 13, but RNTL 14's render is async. Await the render,
 * keeping the route helpers renderRouter attaches (they read the router's
 * global store, so they work after the await).
 */
async function renderRouter(...args: Parameters<typeof renderRouterSync>) {
  const result = renderRouterSync(...args);
  await (result as unknown as Promise<unknown>);
  // Returned as a plain object: returning `result` itself from this async
  // function would unwrap the promise and drop these helpers.
  return {
    getPathname: () => result.getPathname(),
    getSegments: () => result.getSegments(),
  };
}

/** The app's real tab, stack and screen files (the root layout is stubbed to skip splash/welcome/sign-in). */
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/account": Account,
  "(tabs)/(home)/_layout": HomeLayout,
  "(tabs)/(home)/index": HomeIndex,
  "(tabs)/(home)/customer/[customerId]": Customer,
  "(tabs)/(home)/project/[customerId]/[projectId]": Project,
  "(tabs)/(home)/project/[customerId]/[projectId]/pole/[poleId]": ProjectPole,
  "(tabs)/(scan)/_layout": ScanLayout,
  "(tabs)/(scan)/scan": Scan,
  "(tabs)/(home,scan)/pole/[poleNumber]": Pole,
};

const overview = {
  customer: { id: "c1", name: "Coastal Power", addressLine: null, phone: null, active: true },
  summary: { totalLights: 1, connectedLights: 1, totalFaults: 0, percentWorking: 100 },
  projects: [{ id: "p1", name: "North Corridor", active: true, totalLights: 1, connectedLights: 1, totalFaults: 0, percentWorking: 100 }],
};
const project = {
  customer: { id: "c1", name: "Coastal Power" },
  project: { id: "p1", name: "North Corridor", active: true, totalLights: 1, connectedLights: 1, totalFaults: 0, percentWorking: 100 },
  poles: [{ id: "a", poleNumber: "PAS-1", connectedText: "Online", overallStatusText: "OK", lastUpdate: null, openIssues: 0 }],
};

async function signIn(role: string, customerId: string | null) {
  const token = makeToken({ sub: "u1", role, exp: futureExp(), ...(customerId ? { customerId } : {}) });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role, customerId } });
}

function api() {
  return fakeApi({
    listCustomers: jest.fn().mockResolvedValue({ customers: [{ id: "c1", name: "Coastal Power" }] }),
    getCustomerOverview: jest.fn().mockResolvedValue(overview),
    getProject: jest.fn().mockResolvedValue(project),
    getPoleDetail: jest.fn().mockResolvedValue(makePoleDetail(false)),
    lookupPole: jest.fn().mockResolvedValue({ pole: { id: "pole1", poleNumber: "PAS-9", customerId: "c1", projectId: "p1" } }),
  });
}

/** The bottom nav's tab buttons are on screen. */
async function expectTabBar(...labels: string[]) {
  for (const label of labels) {
    expect(await screen.findByRole("button", { name: new RegExp(`^${label}`) })).toBeTruthy();
  }
}

describe("navigation inside the tabs", () => {
  it("keeps the bottom nav visible from the customer list down to a pole, all inside the home tab", async () => {
    await signIn("Streetleaf Admin", null);
    const router = await renderRouter(routes, { initialUrl: "/", wrapper: withSignedInAuth(api()) });

    await fireEvent.press(await screen.findByRole("button", { name: "Coastal Power" }));
    await waitFor(() => expect(router.getPathname()).toBe("/customer/c1"));
    await expectTabBar("Customers", "Scan", "Account");

    await fireEvent.press(await screen.findByRole("button", { name: /^North Corridor/ }));
    await waitFor(() => expect(router.getPathname()).toBe("/project/c1/p1"));
    await expectTabBar("Customers", "Account");

    await fireEvent.press(await screen.findByRole("button", { name: /^Pole PAS-1/ }));
    await waitFor(() => expect(router.getPathname()).toBe("/project/c1/p1/pole/a"));
    expect(router.getSegments()).toEqual(["(tabs)", "(home)", "project", "[customerId]", "[projectId]", "pole", "[poleId]"]);
    expect(await screen.findByLabelText(/^Battery: /)).toBeTruthy(); // the web-style pole page
    await expectTabBar("Customers", "Scan", "Account");
  });

  it("opens a scanned pole inside the Scan tab, with the bottom nav still there", async () => {
    await signIn("Streetleaf Admin", null);
    const router = await renderRouter(routes, { initialUrl: "/scan", wrapper: withSignedInAuth(api()) });

    await fireEvent.changeText(await screen.findByLabelText("Pole number"), "PAS-9");
    await fireEvent.press(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(router.getPathname()).toBe("/pole/PAS-9"));
    expect(router.getSegments()).toEqual(["(tabs)", "(scan)", "pole", "[poleNumber]"]);
    await expectTabBar("Customers", "Scan", "Account");
  });

  it("gives customers the same in-tab navigation from their Projects home", async () => {
    await signIn("Customer Owner", "c1");
    const router = await renderRouter(routes, { initialUrl: "/", wrapper: withSignedInAuth(api()) });

    await fireEvent.press(await screen.findByRole("button", { name: /^North Corridor/ }));
    await waitFor(() => expect(router.getPathname()).toBe("/project/c1/p1"));
    await expectTabBar("Projects", "Account");
    expect(screen.queryByRole("button", { name: /^Scan/ })).toBeNull();
  });
});
