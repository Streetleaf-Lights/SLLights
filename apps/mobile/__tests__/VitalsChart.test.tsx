import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { VitalsChart } from "@/pole/VitalsChart";
import { ApiError } from "@/api/client";
import { sessionStore } from "@/auth/sessionStore";
import { fakeApi, futureExp, makeToken, withSignedInAuth } from "../test-utils/helpers";

beforeEach(async () => {
  const token = makeToken({ sub: "u1", role: "Streetleaf Admin", exp: futureExp() });
  await sessionStore.save({ token, user: { id: "u1", name: "U", email: "u@x.com", role: "Streetleaf Admin", customerId: null } });
});
beforeEach(() => jest.useFakeTimers());
afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

const v = (hour: number, light: number | null, panel: number | null, battery: number | null) => ({
  periodStart: `2026-07-30 ${String(hour).padStart(2, "0")}:00:00-04:00`,
  avgLightPercentage: light,
  avgPanelPercentage: panel,
  avgBatteryPercentage: battery,
});

async function renderChart(getPoleVitals: jest.Mock) {
  const api = fakeApi({ getPoleVitals });
  await render(<VitalsChart customerId="c1" projectId="p1" poleId="pole1" />, { wrapper: withSignedInAuth(api) });
  return api;
}

async function layOut() {
  const plot = await screen.findByTestId("vitals-plot");
  await act(async () => {
    fireEvent(plot, "layout", { nativeEvent: { layout: { width: 320, height: 200 } } });
  });
  return plot;
}

describe("VitalsChart", () => {
  it("loads 2 days by default and shows the legend in the web's order", async () => {
    const api = await renderChart(jest.fn().mockResolvedValue({ vitals: [v(0, 10, 20, 30)] }));
    await screen.findByTestId("vitals-plot");
    expect(api.getPoleVitals).toHaveBeenCalledWith("c1", "p1", "pole1", 2);
    expect(screen.getByRole("radio", { name: "2 days" }).props.accessibilityState.selected).toBe(true);
    const legend = screen.getAllByText(/^(Light|Panel|Battery) %$/).map((n) => n.props.children);
    expect(legend).toEqual(["Light %", "Panel %", "Battery %"]);
  });

  it("reloads with the chosen range", async () => {
    const getPoleVitals = jest.fn().mockResolvedValue({ vitals: [v(0, 10, 20, 30)] });
    await renderChart(getPoleVitals);
    await screen.findByTestId("vitals-plot");
    await fireEvent.press(screen.getByRole("radio", { name: "7 days" }));
    await waitFor(() => expect(getPoleVitals).toHaveBeenLastCalledWith("c1", "p1", "pole1", 7));
    expect(screen.getByRole("radio", { name: "7 days" }).props.accessibilityState.selected).toBe(true);
    expect(await screen.findByLabelText(/last 7 days/)).toBeTruthy();
  });

  it("says so when there's no history", async () => {
    await renderChart(jest.fn().mockResolvedValue({ vitals: [] }));
    expect(await screen.findByText("No vitals history available for this pole.")).toBeTruthy();
  });

  it("shows the error with a retry", async () => {
    const getPoleVitals = jest
      .fn()
      .mockRejectedValueOnce(new ApiError("Couldn't load vitals history. Please try again.", 500))
      .mockResolvedValueOnce({ vitals: [v(0, 10, 20, 30)] });
    await renderChart(getPoleVitals);
    expect(await screen.findByText("Couldn't load vitals history. Please try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("vitals-plot")).toBeTruthy();
  });

  it("leaves reporting gaps as gaps instead of joining across them", async () => {
    // Light reports at 1, 2, then nothing at 3–4, then 5, 6: two separate pieces of line.
    await renderChart(
      jest.fn().mockResolvedValue({
        vitals: [v(1, 10, 50, 80), v(2, 20, 50, 80), v(3, null, 50, 80), v(4, null, 50, 80), v(5, 30, 50, 80), v(6, 40, 50, 80)],
      }),
    );
    await layOut();
    const pieces = (key: string) => screen.queryAllByTestId(`segment-${key}`, { includeHiddenElements: true }).length;
    expect(pieces("light")).toBe(2);
    expect(pieces("panel")).toBe(1);
    expect(pieces("battery")).toBe(1);
  });

  it("reads out date, hour and values where the chart is touched", async () => {
    // Out of order on purpose: points are sorted oldest to newest.
    await renderChart(jest.fn().mockResolvedValue({ vitals: [v(2, 20, 60, 85), v(0, 0, 40, 90), v(1, null, 50, 88)] }));
    const plot = await layOut();
    expect(screen.getByText("Touch the chart to see values.")).toBeTruthy();

    // Plot spans x = 34..310 (width 320, padding 34 left / 10 right): 3 points at 34, 172, 310.
    await act(async () => {
      fireEvent(plot, "responderGrant", { nativeEvent: { locationX: 175 } });
    });
    expect(screen.getByText("Jul 30, 1 AM")).toBeTruthy();
    expect(screen.getByText("Light —")).toBeTruthy(); // a gap reads as a dash, not 0
    expect(screen.getByText("Panel 50%")).toBeTruthy();
    expect(screen.getByText("Battery 88%")).toBeTruthy();

    await act(async () => {
      fireEvent(plot, "responderMove", { nativeEvent: { locationX: 300 } });
    });
    expect(screen.getByText("Jul 30, 2 AM")).toBeTruthy();
    expect(screen.getByText("Light 20%")).toBeTruthy();
  });
});
