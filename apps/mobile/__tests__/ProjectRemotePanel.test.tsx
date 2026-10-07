import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ProjectDetailView } from "@/monitoring/ProjectDetailView";
import { ProjectRemotePanel } from "@/remote/ProjectRemotePanel";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const light = (n: number, lamp: "on" | "off" | "unknown") => ({
  poleNumber: `PAS-${n}`,
  productName: `LOC-${n}`,
  providedProductId: `AEX-${n}`,
  lamp,
});
const remoteWith = (lamps: Record<number, "on" | "off" | "unknown">) => ({
  remote: {
    projectName: "North (Leadsun)",
    statusError: null,
    gateways: [
      { name: "Gateway A", code: "GW-A", lights: [light(1, lamps[1] ?? "off"), light(2, lamps[2] ?? "off")] },
      { name: "Gateway B", code: "GW-B", lights: [light(3, lamps[3] ?? "off")] },
    ],
  },
});

beforeEach(async () => {
  const token = makeToken({ sub: "a1", role: "Streetleaf Admin", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "a1", name: "A", email: "a@x.com", role: "Streetleaf Admin", customerId: null } });
});
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

async function renderPanel(getProjectRemote = jest.fn().mockResolvedValue(remoteWith({ 1: "on" }))) {
  const api = fakeApi({ getProjectRemote });
  const onClose = jest.fn();
  await render(<ProjectRemotePanel customerId="c1" projectId="p1" onClose={onClose} />, { wrapper: withSignedInAuth(api) });
  await screen.findByText("North (Leadsun)");
  return { api, onClose };
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const go = () => fireEvent.press(screen.getByRole("button", { name: /^(GO!|TURN OFF)$/ }));

describe("ProjectRemotePanel", () => {
  it("summarises the project, with gateways collapsed until opened", async () => {
    const { api } = await renderPanel();
    expect(api.getProjectRemote).toHaveBeenCalledWith("c1", "p1");
    expect(screen.getByText("2 Gateways · 3 Lights")).toBeTruthy();
    expect(screen.getByText("Gateway A")).toBeTruthy();
    expect(screen.queryByText("LOC-1")).toBeNull();

    await press(/^Gateway A,/);
    expect(screen.getByText("LOC-1")).toBeTruthy();
    expect(screen.getByText("AEX-1")).toBeTruthy();
    expect(screen.getAllByLabelText("Light is ON")).toHaveLength(1);
    expect(screen.getAllByLabelText("Light is OFF")).toHaveLength(1);
  });

  it("Project Control switches the whole project when every pole is included", async () => {
    const { api } = await renderPanel();
    await press("Project Control");
    expect(screen.getByText("Project Remote Control")).toBeTruthy();
    expect(screen.getByText("3 of 3 poles affected")).toBeTruthy();
    await go();
    await waitFor(() =>
      expect(api.sendProjectLightCommand).toHaveBeenCalledWith("c1", "p1", { brightness: 50, time: 30, target: { kind: "project" } }),
    );
  });

  it("leaving a pole out sends just the included lights instead", async () => {
    const { api } = await renderPanel();
    await press("Project Control");
    await fireEvent(screen.getByLabelText("Include PAS-2 in this action"), "valueChange", false);
    expect(screen.getByText("2 of 3 poles affected")).toBeTruthy();
    await go();
    await waitFor(() =>
      expect(api.sendProjectLightCommand).toHaveBeenCalledWith("c1", "p1", {
        brightness: 50,
        time: 30,
        target: { kind: "lights", productNames: ["LOC-1", "LOC-3"] },
      }),
    );
  });

  it("can't send with every pole left out", async () => {
    await renderPanel();
    await press("Project Control");
    for (const n of [1, 2, 3]) await fireEvent(screen.getByLabelText(`Include PAS-${n} in this action`), "valueChange", false);
    expect(screen.getByRole("button", { name: "GO!" }).props.accessibilityState.disabled).toBe(true);
  });

  it("Gateway Control switches that gateway", async () => {
    const { api } = await renderPanel();
    const gatewayB = screen.getAllByRole("button", { name: "Gateway Control" })[1];
    await fireEvent.press(gatewayB);
    expect(screen.getByText("Gateway Remote Control — Gateway B")).toBeTruthy();
    expect(screen.getByText("1 of 1 pole affected")).toBeTruthy();
    await go();
    await waitFor(() =>
      expect(api.sendProjectLightCommand).toHaveBeenCalledWith("c1", "p1", {
        brightness: 50,
        time: 30,
        target: { kind: "gateway", gatewayCode: "GW-B" },
      }),
    );
  });

  it("a light's Control switches just that light", async () => {
    const { api } = await renderPanel();
    await press(/^Gateway A,/);
    await press("Control LOC-2");
    expect(screen.getByText("Light Remote Control — LOC-2")).toBeTruthy();
    expect(screen.queryByText(/poles? affected/)).toBeNull(); // no list for a single light
    await go();
    await waitFor(() =>
      expect(api.sendProjectLightCommand).toHaveBeenCalledWith("c1", "p1", {
        brightness: 50,
        time: 30,
        target: { kind: "lights", productNames: ["LOC-2"] },
      }),
    );
  });

  it("confirms only once every included light matches, then refreshes the list", async () => {
    const getProjectRemote = jest
      .fn()
      .mockResolvedValueOnce(remoteWith({})) // open: all off
      .mockResolvedValueOnce(remoteWith({ 1: "on", 2: "on" })) // check 1: LOC-3 still off
      .mockResolvedValue(remoteWith({ 1: "on", 2: "on", 3: "on" })); // check 2: all on
    await renderPanel(getProjectRemote);
    await press("Project Control");
    await go();
    expect(await screen.findByText("Confirming the 3 lights are ON…")).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText(/^Confirmed/)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(await screen.findByText("Confirmed: all 3 lights are ON.")).toBeTruthy();
    await waitFor(() => expect(getProjectRemote.mock.calls.length).toBeGreaterThanOrEqual(4)); // + the refresh
  });

  it("Cancel closes the form; Close closes the panel", async () => {
    const { onClose } = await renderPanel();
    await press("Project Control");
    await press("Cancel");
    expect(screen.queryByText("Project Remote Control")).toBeNull();
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await fireEvent.press(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("header Remote Control pills", () => {
  it("is a small pill in the project header when the project has Leadsun lights, opening the panel", async () => {
    const project = {
      customer: { id: "c1", name: "Coastal Power" },
      project: { id: "p1", name: "North", active: true, totalLights: 3, connectedLights: 3, totalFaults: 0, percentWorking: 100 },
      poles: [],
      hasRemoteControl: true,
    };
    const api = fakeApi({
      getProject: jest.fn().mockResolvedValue(project),
      getProjectRemote: jest.fn().mockResolvedValue(remoteWith({})),
    });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped={false} />, { wrapper: withSignedInAuth(api) });
    const pill = await screen.findByRole("button", { name: "Remote Control" });
    // Shares the title row with the customer name (top right), rather than a full-width button.
    expect(within(screen.getByText("Coastal Power").parent!.parent!).getByRole("button", { name: "Remote Control" })).toBeTruthy();
    await fireEvent.press(pill);
    expect(await screen.findByTestId("project-remote-panel")).toBeTruthy();
  });

  it("isn't shown for a project without Leadsun lights", async () => {
    const api = fakeApi({
      getProject: jest.fn().mockResolvedValue({
        customer: { id: "c1", name: "Coastal Power" },
        project: { id: "p1", name: "North", active: true, totalLights: 0, connectedLights: 0, totalFaults: 0, percentWorking: null },
        poles: [],
        hasRemoteControl: false,
      }),
    });
    await render(<ProjectDetailView customerId="c1" projectId="p1" viewerScoped={false} />, { wrapper: withSignedInAuth(api) });
    await screen.findByText("Coastal Power");
    expect(screen.queryByRole("button", { name: "Remote Control" })).toBeNull();
  });
});
