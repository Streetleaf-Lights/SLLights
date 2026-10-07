import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { RemoteControlPanel } from "@/pole/RemoteControlPanel";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

const remote = (lamp: "on" | "off" | "unknown", statusError: string | null = null) => ({
  remote: { productName: "LOC-1", providedProductId: "AEX-1", gatewayName: "Gateway A", lamp, statusError },
});

beforeEach(async () => {
  const token = makeToken({ sub: "u1", role: "Customer Owner", customerId: "c1", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "Customer Owner", customerId: "c1" } });
});
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

async function renderPanel(getPoleRemote: jest.Mock, sendLightCommand?: jest.Mock) {
  const api = fakeApi({ getPoleRemote, ...(sendLightCommand ? { sendLightCommand } : {}) });
  const onClose = jest.fn();
  await render(<RemoteControlPanel customerId="c1" projectId="p1" poleId="pole1" onClose={onClose} />, {
    wrapper: withSignedInAuth(api),
  });
  return { api, onClose };
}

const tick = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

const openForm = async () => fireEvent.press(await screen.findByRole("button", { name: "Control" }));
const submitButton = () => screen.getByRole("button", { name: /^(GO!|TURN OFF|Wait \d+s|Submitting…)$/ });

describe("RemoteControlPanel", () => {
  it("shows the pole's product, device id, gateway and live state", async () => {
    const { api } = await renderPanel(jest.fn().mockResolvedValue(remote("on")));
    expect(await screen.findByText("LOC-1")).toBeTruthy();
    expect(screen.getByText("AEX-1")).toBeTruthy();
    expect(screen.getByText("Gateway: Gateway A")).toBeTruthy();
    expect(screen.getByLabelText("Light is ON")).toBeTruthy();
    expect(api.getPoleRemote).toHaveBeenCalledWith("c1", "p1", "pole1");
  });

  it("shows Unknown with the message when live status couldn't be read", async () => {
    await renderPanel(jest.fn().mockResolvedValue(remote("unknown", "Couldn't load live ON/OFF status.")));
    expect(await screen.findByLabelText("Light is Unknown")).toBeTruthy();
    expect(screen.getByText("Couldn't load live ON/OFF status.")).toBeTruthy();
  });

  it("opens the web's form: brightness 50, 30 seconds, GO!", async () => {
    await renderPanel(jest.fn().mockResolvedValue(remote("off")));
    await openForm();
    expect(screen.getByText("Brightness (50)")).toBeTruthy();
    expect(screen.getByTestId("brightness-slider").props).toMatchObject({ minimumValue: 0, maximumValue: 100, step: 1 });
    expect(screen.getByLabelText("Time (seconds)").props.value).toBe("30");
    expect(submitButton()).toHaveAccessibleName("GO!");
  });

  it("says TURN OFF at brightness 0", async () => {
    await renderPanel(jest.fn().mockResolvedValue(remote("on")));
    await openForm();
    await act(async () => screen.getByTestId("brightness-slider").props.onValueChange(0));
    expect(screen.getByText("Brightness (0)")).toBeTruthy();
    expect(submitButton()).toHaveAccessibleName("TURN OFF");
  });

  it("disables the button for a time outside 1–3600 seconds", async () => {
    await renderPanel(jest.fn().mockResolvedValue(remote("off")));
    await openForm();
    await fireEvent.changeText(screen.getByLabelText("Time (seconds)"), "0");
    expect(submitButton().props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Time must be 1–3600 seconds.")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Time (seconds)"), "4000");
    expect(submitButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Time (seconds)"), "90");
    expect(submitButton().props.accessibilityState.disabled).toBe(false);
  });

  it("sends only brightness and time, then confirms once the light matches", async () => {
    const getPoleRemote = jest
      .fn()
      .mockResolvedValueOnce(remote("off")) // when the panel opens
      .mockResolvedValueOnce(remote("off")) // 1st check: not yet
      .mockResolvedValueOnce(remote("on")); // 2nd check: matches
    const { api } = await renderPanel(getPoleRemote);
    await openForm();
    await fireEvent.changeText(screen.getByLabelText("Time (seconds)"), "60");
    await fireEvent.press(submitButton());

    await waitFor(() => expect(api.sendLightCommand).toHaveBeenCalledWith("c1", "p1", "pole1", { brightness: 50, time: 60 }));
    expect(await screen.findByText("Request successful")).toBeTruthy();
    expect(screen.getByText("Confirming the light is ON…")).toBeTruthy();

    await tick(1000);
    await tick(1000);
    expect(await screen.findByText("Confirmed: the light is ON.")).toBeTruthy();
    expect(screen.getByLabelText("Light is ON")).toBeTruthy();
    expect(getPoleRemote).toHaveBeenCalledTimes(3);
  });

  it("gives up after 15 checks and offers to check again", async () => {
    const getPoleRemote = jest.fn().mockResolvedValue(remote("on"));
    await renderPanel(getPoleRemote);
    await openForm();
    await act(async () => screen.getByTestId("brightness-slider").props.onValueChange(0));
    await fireEvent.press(submitButton());
    for (let i = 0; i < 15; i++) await tick(1000);
    expect(await screen.findByText("Didn't confirm — the light may not have changed yet.")).toBeTruthy();
    expect(getPoleRemote).toHaveBeenCalledTimes(1 + 15); // the open, then 15 checks — no more
    await fireEvent.press(screen.getByRole("button", { name: "Check again" }));
    expect(screen.getByText("Confirming the light is OFF…")).toBeTruthy();
  });

  it("waits 10 seconds between commands, even after a failure", async () => {
    const send = jest.fn().mockRejectedValueOnce(new ApiError("Leadsun EDGE API request failed", 502));
    await renderPanel(jest.fn().mockResolvedValue(remote("off")), send);
    await openForm();
    await fireEvent.press(submitButton());
    expect(await screen.findByText("Leadsun EDGE API request failed")).toBeTruthy();
    expect(submitButton()).toHaveAccessibleName("Wait 10s");
    expect(submitButton().props.accessibilityState.disabled).toBe(true);
    await tick(3000);
    expect(submitButton()).toHaveAccessibleName("Wait 7s");
    await tick(7000);
    expect(submitButton()).toHaveAccessibleName("GO!");
    expect(submitButton().props.accessibilityState.disabled).toBe(false);
  });

  it("closes", async () => {
    const { onClose } = await renderPanel(jest.fn().mockResolvedValue(remote("off")));
    await fireEvent.press(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
