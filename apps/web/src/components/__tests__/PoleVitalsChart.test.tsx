import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

// Captures the props each <Line> actually receives from PoleVitalsChart —
// specifically for asserting connectNulls is never set (see the test
// below) — while still rendering the real recharts <Line> underneath, so
// the rest of this file's tests exercise the genuine chart output.
const capturedLineProps: Record<string, unknown>[] = [];
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    Line: (props: Record<string, unknown>) => {
      capturedLineProps.push(props);
      return createElement(actual.Line, props);
    },
  };
});

import {
  formatPeriodLabel,
  formatTickLabel,
  formatTooltipLabel,
  PoleVitalsChart,
} from "@/components/PoleVitalsChart";

// Recharts' ResponsiveContainer needs real DOM dimensions to render its
// children (legend, lines, axes); jsdom reports 0x0 by default, which
// causes it to render nothing. Force a plausible size for these tests.
beforeEach(() => {
  capturedLineProps.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 600,
    height: 256,
    top: 0,
    left: 0,
    bottom: 256,
    right: 600,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  })) as typeof Element.prototype.getBoundingClientRect;
});

function mockVitalsResponse(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

const sampleVitals = [
  {
    periodStart: "2026-07-30 11:00:00-04:00",
    periodEnd: "2026-07-30 12:00:00-04:00",
    lightStatus: "DayLight",
    isOnline: true,
    avgBatteryPercentage: 100.0,
    avgPanelPercentage: 60.3,
    avgLightPercentage: 0.0,
  },
  {
    periodStart: "2026-07-30 09:00:00-04:00",
    periodEnd: "2026-07-30 10:00:00-04:00",
    lightStatus: "DayLight",
    isOnline: true,
    avgBatteryPercentage: 95.0,
    avgPanelPercentage: 40.1,
    avgLightPercentage: 0.0,
  },
];

describe("PoleVitalsChart", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state before the fetch resolves", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("fetches Hourly data with limit=48 (2 days) by default", async () => {
    const fetchMock = mockVitalsResponse(true, { vitals: sampleVitals });
    vi.stubGlobal("fetch", fetchMock);

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/getpolevitalsbyperiod?poleId=recAOlPiepBddUcCv&periodType=Hour&limit=48",
    );
  });

  it("shows a 'Show' dropdown defaulting to 2 days, not the old Hourly/Daily buttons", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sampleVitals }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await screen.findByText("Battery %");

    expect(screen.queryByRole("button", { name: "Hourly" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Daily" })).not.toBeInTheDocument();

    const dropdown = screen.getByLabelText("Show") as HTMLSelectElement;
    expect(dropdown.value).toBe("2");
  });

  it("re-fetches with periodType=Hour and the new limit (days * 24) when a different day count is selected", async () => {
    const fetchMock = mockVitalsResponse(true, { vitals: sampleVitals });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText("Show"), "7");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/getpolevitalsbyperiod?poleId=recAOlPiepBddUcCv&periodType=Hour&limit=168",
    );
  });

  it.each([
    [7, 168],
    [14, 336],
    [30, 720],
  ])(
    "requests the full uncapped limit for %i days (limit=%i), not truncated to 48 like the 1/2-day options",
    async (days, expectedLimit) => {
      const fetchMock = mockVitalsResponse(true, { vitals: sampleVitals });
      vi.stubGlobal("fetch", fetchMock);

      const user = userEvent.setup();
      render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      await user.selectOptions(screen.getByLabelText("Show"), String(days));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/getpolevitalsbyperiod?poleId=recAOlPiepBddUcCv&periodType=Hour&limit=${expectedLimit}`,
      );
    },
  );

  it("offers 1, 2, 7, 14, and 30 day options (no 3 days)", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sampleVitals }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await screen.findByText("Battery %");

    const dropdown = screen.getByLabelText("Show");
    const optionLabels = Array.from(dropdown.querySelectorAll("option")).map(
      (opt) => opt.textContent,
    );
    expect(optionLabels).toEqual(["1 day", "2 days", "7 days", "14 days", "30 days"]);
  });

  it("renders the chart legend once data loads", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sampleVitals }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(await screen.findByText("Battery %")).toBeInTheDocument();
    expect(screen.getByText("Panel %")).toBeInTheDocument();
    expect(screen.getByText("Light %")).toBeInTheDocument();
  });

  it("does not set connectNulls on any of the three lines — a gap in reporting (a run of null vitals) should show as a visual break in the line, not a straight line drawn across it as if that data were real", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sampleVitals }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await screen.findByText("Light %");

    expect(capturedLineProps.length).toBeGreaterThan(0);
    for (const props of capturedLineProps) {
      expect(props.connectNulls).not.toBe(true);
    }
  });

  it("lists the legend/lines in order: Light, Panel, Battery", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sampleVitals }));

    const { container } = render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await screen.findByText("Light %");

    const text = container.textContent ?? "";
    const lightIndex = text.indexOf("Light %");
    const panelIndex = text.indexOf("Panel %");
    const batteryIndex = text.indexOf("Battery %");

    expect(lightIndex).toBeGreaterThanOrEqual(0);
    expect(panelIndex).toBeGreaterThan(lightIndex);
    expect(batteryIndex).toBeGreaterThan(panelIndex);
  });

  it("shows the date (not a time) at midnight — the day boundary", () => {
    expect(formatPeriodLabel("2026-07-30 00:00:00-04:00", "Hour")).toBe("Jul 30");
  });

  it("shows just the hour (no date, no minutes) for any other hour", () => {
    expect(formatPeriodLabel("2026-07-30 11:00:00-04:00", "Hour")).toMatch(/^\d{1,2}\s?(AM|PM)$/);
    expect(formatPeriodLabel("2026-07-30 19:00:00-04:00", "Hour")).toMatch(/^\d{1,2}\s?(AM|PM)$/);
  });

  it("legitimately repeats the same hour-only text across different days (disambiguated by the nearest midnight label, not per-point uniqueness)", () => {
    const label1 = formatPeriodLabel("2026-07-30 11:00:00-04:00", "Hour");
    const label2 = formatPeriodLabel("2026-07-31 11:00:00-04:00", "Hour");

    expect(label1).toBe(label2);
  });

  it("formats a Daily label as month + day", () => {
    expect(formatPeriodLabel("2026-07-30 11:00:00-04:00", "Day")).toBe("Jul 30");
  });

  it("tooltip label always includes the day, unlike the axis tick (which only shows it at midnight)", () => {
    expect(formatTooltipLabel("2026-07-30 18:00:00-04:00", "Hour")).toBe("Jul 30, 6 PM");
    // Confirm this really differs from the axis tick text for the same point.
    expect(formatPeriodLabel("2026-07-30 18:00:00-04:00", "Hour")).toBe("6 PM");
  });

  it("tooltip label for Daily is just the date (no time component to add)", () => {
    expect(formatTooltipLabel("2026-07-30 11:00:00-04:00", "Day")).toBe("Jul 30");
  });

  it("tooltip label handles a missing/malformed periodStart the same way formatPeriodLabel does", () => {
    expect(formatTooltipLabel(null, "Hour")).toBe("—");
    expect(formatTooltipLabel(undefined, "Hour")).toBe("—");
    expect(formatTooltipLabel("not-a-real-date", "Hour")).toBe("not-a-real-date");
  });

  it("looks up a tick's label by its actual data-point index, not by the tick's position among however many Recharts chose to render", () => {
    // Simulates 48 hourly chartData rows, the way the component builds
    // them (each row's own "index" field is its position in this array).
    // Recharts thins the ticks it actually shows/labels when there isn't
    // room for all 48 — so the *value* passed to tickFormatter for a given
    // rendered tick is this real data-point index (e.g. 42), which can be
    // completely different from that tick's position among the rendered
    // subset (e.g. it might be only the 6th tick shown). Using the latter
    // to look up chartData previously caused every label to point at the
    // wrong data point once thinning kicked in.
    const chartData = Array.from({ length: 48 }, (_, i) => ({
      periodStart: `2026-07-30 ${String(i % 24).padStart(2, "0")}:00:00-04:00`,
    }));

    // Data-point index 42 -> hour 18 (6 PM) on the 2nd day covered by this
    // 48h window. If the tick-position argument were used instead (e.g.
    // this being only the 6th tick actually rendered), it would incorrectly
    // resolve to chartData[6] -> hour 6 (6 AM) instead.
    expect(formatTickLabel(chartData, 42, "Hour")).toBe(
      formatPeriodLabel(chartData[42].periodStart, "Hour"),
    );
    expect(formatTickLabel(chartData, 42, "Hour")).not.toBe(
      formatPeriodLabel(chartData[6].periodStart, "Hour"),
    );
  });

  it("renders successfully with duplicate same-hour-text points across two days, without crashing", async () => {
    // This is the scenario the axis-key fix (see the component's chartData
    // comment) targets: two points that legitimately render identical
    // display text via formatPeriodLabel, but must still each resolve to
    // their own distinct data when hovered/rendered — not collapse onto
    // or resolve to each other. Recharts never renders actual <path>
    // geometry in jsdom (verified directly — lines don't draw here even
    // with container dimensions mocked), so this checks what jsdom *can*
    // verify: the chart mounts cleanly and the full series set renders,
    // with the fix's correctness otherwise covered by the formatPeriodLabel
    // unit tests above and the mapping's structural 1:1 index assignment.
    const sameHourDifferentDays = [
      {
        periodStart: "2026-07-30 19:00:00-04:00",
        periodEnd: "2026-07-30 20:00:00-04:00",
        lightStatus: "DayLight",
        isOnline: true,
        avgBatteryPercentage: 5,
        avgPanelPercentage: 5,
        avgLightPercentage: 5,
      },
      {
        periodStart: "2026-07-31 19:00:00-04:00",
        periodEnd: "2026-07-31 20:00:00-04:00",
        lightStatus: "DayLight",
        isOnline: true,
        avgBatteryPercentage: 95,
        avgPanelPercentage: 95,
        avgLightPercentage: 95,
      },
    ];
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: sameHourDifferentDays }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(await screen.findByText("Light %")).toBeInTheDocument();
    expect(screen.getByText("Panel %")).toBeInTheDocument();
    expect(screen.getByText("Battery %")).toBeInTheDocument();
  });

  it("does not crash when a vital entry has a missing/undefined periodStart", async () => {
    const vitalsWithMissingPeriodStart = [
      { ...sampleVitals[0], periodStart: undefined },
      sampleVitals[1],
    ];
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: vitalsWithMissingPeriodStart }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(await screen.findByText("Battery %")).toBeInTheDocument();
  });

  it("shows an empty-state message when there is no vitals history", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(true, { vitals: [] }));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(
      await screen.findByText("No vitals history available for this pole."),
    ).toBeInTheDocument();
  });

  it("shows the server's error message on failure (e.g. pole not found)", async () => {
    vi.stubGlobal("fetch", mockVitalsResponse(false, { error: "pole not found" }));

    render(<PoleVitalsChart poleId="does-not-exist" />);

    expect(await screen.findByText("pole not found")).toBeInTheDocument();
  });

  it("shows a fallback error message when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);

    expect(
      await screen.findByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });

  it("clears a previous error once a new fetch (triggered by a poleId change) succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "pole not found" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ vitals: sampleVitals }) });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<PoleVitalsChart poleId="recAOlPiepBddUcCv" />);
    await screen.findByText("pole not found");

    rerender(<PoleVitalsChart poleId="recDifferentPole" />);

    await screen.findByText("Battery %");
    expect(screen.queryByText("pole not found")).not.toBeInTheDocument();
  });
});
