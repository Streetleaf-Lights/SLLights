import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { RemoteControlLink } from "@/components/RemoteControlLink";
import type { LeadsunLampStatus, LeadsunProduct, LeadsunProject } from "@/lib/types";

const product: LeadsunProduct = {
  ProductId: 12548,
  ProductName: "12081-1102",
  ProvidedProductId: "AEXSAP4323111877",
  PoleNumber: "AEXSAP4323111877-A",
};

const leadsunProject: LeadsunProject = {
  ProjectId: "482",
  ProjectName: "Chaparral",
  totalGateways: 2,
  totalPoles: 5,
  groups: [
    {
      GroupId: 1149,
      GroupName: "Chaparral Ph3",
      GatewayCode: "GT18L94A25082883",
      totalPoles: 3,
      products: [
        {
          ProductId: 1,
          ProductName: "12009-1001",
          ProvidedProductId: "PROV-1",
          PoleNumber: "PROV-1-A",
        },
        {
          ProductId: 2,
          ProductName: "12009-1002",
          ProvidedProductId: "PROV-2",
          PoleNumber: "PROV-2-A",
        },
      ],
    },
    {
      GroupId: 1150,
      GroupName: "Chaparral Ph4",
      GatewayCode: "GT18L94A25082884",
      totalPoles: 2,
      products: [
        {
          ProductId: 3,
          ProductName: "12009-2001",
          ProvidedProductId: "PROV-3",
          PoleNumber: "PROV-3-A",
        },
      ],
    },
  ],
};

function makeLamp(overrides: Partial<LeadsunLampStatus> = {}): LeadsunLampStatus {
  return {
    productId: "1",
    lampPower1: 0,
    lampPower2: 0,
    ...overrides,
  };
}

function mockFetchOnce(lamps: LeadsunLampStatus[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/api/setpolelights")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Request successful",
              statusCode: "200",
              data: null,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(lamps) });
    }),
  );
}

function mockFetchFailure() {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/api/setpolelights")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: "Request successful",
              statusCode: "200",
              data: null,
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }),
  );
}

/**
 * Mocks both endpoints independently — the lamp-status GET (used for the
 * ON/OFF indicators) and the setpolelights POST (used by the GO!/TURN OFF
 * button) — since tests exercising the submit flow need to control both.
 */
function mockFetchRouted({
  lamps = [] as LeadsunLampStatus[],
  setPoleLightsResponse = {
    ok: true,
    body: { success: true, message: "Request successful", statusCode: "200", data: null },
  },
}: {
  lamps?: LeadsunLampStatus[];
  setPoleLightsResponse?: { ok: boolean; body: unknown };
} = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/api/setpolelights")) {
        return Promise.resolve({
          ok: setPoleLightsResponse.ok,
          json: () => Promise.resolve(setPoleLightsResponse.body),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(lamps) });
    }),
  );
}

/**
 * Like mockFetchRouted, but the lamp-status GET returns a different array
 * on each successive call (staying on the last one once the sequence is
 * exhausted) — needed to simulate a light's status actually changing
 * partway through a poll loop.
 */
function mockFetchSequenced({
  lampSequence,
  setPoleLightsResponse = {
    ok: true,
    body: { success: true, message: "Request successful", statusCode: "200", data: null },
  },
}: {
  lampSequence: LeadsunLampStatus[][];
  setPoleLightsResponse?: { ok: boolean; body: unknown };
}) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (typeof url === "string" && url.includes("/api/setpolelights")) {
        return Promise.resolve({
          ok: setPoleLightsResponse.ok,
          json: () => Promise.resolve(setPoleLightsResponse.body),
        });
      }
      const lamps = lampSequence[Math.min(call, lampSequence.length - 1)];
      call += 1;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(lamps) });
    }),
  );
}

/**
 * Mocks setTimeout so only the given delays are intercepted (captured via
 * mock.calls, invoked manually in a test) — everything else, including
 * testing-library's own internal setTimeout-based polling (e.g. inside
 * findByText), passes through to the real setTimeout untouched.
 */
function mockSetTimeoutIntercepting(interceptDelays: number[]) {
  const originalSetTimeout = global.setTimeout;
  return vi
    .spyOn(global, "setTimeout")
    .mockImplementation(((fn: () => void, delay?: number, ...args: unknown[]) => {
      if (delay !== undefined && interceptDelays.includes(delay)) {
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(fn, delay, ...args);
    }) as typeof setTimeout);
}

/** Manually invokes the most recently scheduled setTimeout callback for the given delay, awaiting any async work inside it. */
async function advanceScheduled(
  setTimeoutSpy: ReturnType<typeof mockSetTimeoutIntercepting>,
  delay: number,
) {
  const calls = setTimeoutSpy.mock.calls.filter(([, d]) => d === delay);
  const lastCall = calls[calls.length - 1];
  if (!lastCall) throw new Error(`No pending setTimeout(..., ${delay}) call to advance`);
  const callback = lastCall[0] as () => Promise<void> | void;
  await act(async () => {
    await callback();
  });
}

/** Finds the setpolelights POST call among all fetch calls and returns its parsed body. */
function findSetPoleLightsBody(): Record<string, unknown> {
  const calls = (fetch as unknown as { mock: { calls: [string, { body: string }][] } }).mock
    .calls;
  const call = calls.find(([url]) => url.includes("/api/setpolelights"));
  if (!call) throw new Error("No call to /api/setpolelights was made");
  return JSON.parse(call[1].body);
}

/** Counts fetch calls to the lamp-status endpoint so far. */
function countLampStatusFetches(): number {
  const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls;
  return calls.filter(([url]) => url.includes("/api/leadsunlampstatus")).length;
}

describe("RemoteControlLink", () => {
  beforeEach(() => {
    mockFetchOnce([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Guarantees any vi.spyOn-based mock (e.g. the setTimeout spies below)
    // gets restored even if a test failed an assertion before reaching its
    // own .mockRestore() — otherwise an un-restored spy poisons every
    // subsequent test in this file (each new spy would capture the
    // previous one as its "original", eventually recursing infinitely).
    vi.restoreAllMocks();
  });

  it("renders a 'Remote Control' trigger, with no modal open yet", () => {
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    expect(screen.getByRole("button", { name: "Remote Control" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the accent color (not accent-ink) for the default trigger styling", () => {
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    const trigger = screen.getByRole("button", { name: "Remote Control" });
    expect(trigger.className).toContain("text-[var(--accent)]");
    expect(trigger.className).not.toContain("--accent-ink");
  });

  it("looks like a button (bordered/padded) and explicitly shows a pointer cursor on hover — Tailwind's preflight otherwise resets <button> to cursor: default", () => {
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    const trigger = screen.getByRole("button", { name: "Remote Control" });
    expect(trigger.className).toContain("cursor-pointer");
    expect(trigger.className).toContain("border");
    expect(trigger.className).toContain("rounded-md");
  });

  it("closes the modal via the Close button", async () => {
    const user = userEvent.setup();
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    await user.click(screen.getByRole("button", { name: "Remote Control" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the modal when clicking the backdrop", async () => {
    const user = userEvent.setup();
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    await user.click(screen.getByRole("button", { name: "Remote Control" }));

    const backdrop = screen.getByRole("dialog").parentElement;
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close the modal when clicking inside the dialog panel itself", async () => {
    const user = userEvent.setup();
    render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
    await user.click(screen.getByRole("button", { name: "Remote Control" }));

    await user.click(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("accepts a custom className for the trigger", () => {
    render(
      <RemoteControlLink
        projectId="rec123"
        leadsunProject={leadsunProject}
        product={product}
        className="custom-trigger-class"
      />,
    );
    expect(screen.getByRole("button", { name: "Remote Control" }).className).toBe(
      "custom-trigger-class",
    );
  });

  describe("live status fetch", () => {
    it("fetches from /api/leadsunlampstatus with projectId and productId, in pole mode", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(fetch).toHaveBeenCalledWith(
        "/api/leadsunlampstatus?projectId=482&productId=AEXSAP4323111877",
        { cache: "no-store" },
      );
    });

    it("fetches from /api/leadsunlampstatus with just projectId, in project mode (no productId)", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(fetch).toHaveBeenCalledWith("/api/leadsunlampstatus?projectId=482", {
        cache: "no-store",
      });
    });

    it("shows a loading indicator before the fetch resolves", async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      vi.stubGlobal(
        "fetch",
        vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
        ),
      );
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(screen.getByText("…")).toBeInTheDocument();
      resolveFetch({ ok: true, json: () => Promise.resolve([]) });
      await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
    });

    it("shows ON (with the lit-bulb color/glow) when lampPower1+lampPower2 > 0", async () => {
      mockFetchOnce([makeLamp({ productId: "AEXSAP4323111877", lampPower1: 45, lampPower2: 0 })]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const onLabel = await screen.findByText("ON");
      expect(onLabel.className).toContain("bg-[#fef3c7]");
      const dot = onLabel.firstElementChild as HTMLElement;
      expect(dot.className).toContain("bg-[#f59e0b]");
      expect(dot.className).toContain("shadow-");
    });

    it("shows OFF when lampPower1+lampPower2 === 0", async () => {
      mockFetchOnce([makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(await screen.findByText("OFF")).toBeInTheDocument();
      expect(screen.queryByText("ON")).not.toBeInTheDocument();
    });

    it("shows ON when only one of the two lamp channels is drawing power", async () => {
      mockFetchOnce([makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 12 })]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(await screen.findByText("ON")).toBeInTheDocument();
    });

    it("shows an unknown ('—') indicator when the fetch succeeds but has no entry for this product", async () => {
      mockFetchOnce([]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
    });

    it("shows an error note (including the failure reason) and unknown indicators when the fetch fails", async () => {
      mockFetchFailure();
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(
        await screen.findByText(/Couldn.t load live ON\/OFF status\./),
      ).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("surfaces the server's own 'detail' message in the error note, when the route provides one", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: () =>
            Promise.resolve({
              error: "Couldn't load live lamp status. Please try again.",
              detail: "LEADSUN_CLIENT_CERT_PEM is not configured",
            }),
        }),
      );
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(
        await screen.findByText(/LEADSUN_CLIENT_CERT_PEM is not configured/),
      ).toBeInTheDocument();
    });

    it("falls back to a status-code message when the failed response has no JSON body at all", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error("not json")),
        }),
      );
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(await screen.findByText(/request failed \(500\)/)).toBeInTheDocument();
    });

    it("re-fetches with fresh status each time the modal is reopened", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Close" }));
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("affected-poles table: header rename, Selected toggle, scroll hints", () => {
    it("labels the first column 'Gateway', not 'Gateway Name'", async () => {
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      expect(screen.getByRole("columnheader", { name: "Gateway" })).toBeInTheDocument();
      expect(screen.queryByRole("columnheader", { name: "Gateway Name" })).not.toBeInTheDocument();
    });

    it("has a 'Selected' toggle per pole, checked (included) by default", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const toggles = screen.getAllByRole("switch");
      expect(toggles).toHaveLength(3);
      for (const toggle of toggles) {
        expect(toggle).toBeChecked();
      }
    });

    it("can deselect and reselect an individual pole independently of the others", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const [firstToggle, secondToggle] = screen.getAllByRole("switch");
      await user.click(firstToggle);

      expect(firstToggle).not.toBeChecked();
      expect(secondToggle).toBeChecked();

      await user.click(firstToggle);
      expect(firstToggle).toBeChecked();
    });

    it("does not show scroll hints when the pole list is short enough to fit without scrolling", async () => {
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      // jsdom reports 0 for scrollHeight/clientHeight by default — no overflow.
      expect(screen.queryByText("▲")).not.toBeInTheDocument();
      expect(screen.queryByText("▼")).not.toBeInTheDocument();
    });

    it("shows a down-scroll hint when the pole list overflows and is scrolled to the top", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const list = screen.getByRole("columnheader", { name: "Gateway" }).closest(
        'div[class*="overflow-y-auto"]',
      ) as HTMLElement;
      Object.defineProperty(list, "scrollHeight", { value: 400, configurable: true });
      Object.defineProperty(list, "clientHeight", { value: 100, configurable: true });
      Object.defineProperty(list, "scrollTop", { value: 0, configurable: true });
      fireEvent.scroll(list);

      expect(screen.getByText("▼")).toBeInTheDocument();
      expect(screen.queryByText("▲")).not.toBeInTheDocument();
    });

    it("shows an up-scroll hint once scrolled away from the top, and hides the down hint once scrolled to the bottom", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const list = screen.getByRole("columnheader", { name: "Gateway" }).closest(
        'div[class*="overflow-y-auto"]',
      ) as HTMLElement;
      Object.defineProperty(list, "scrollHeight", { value: 400, configurable: true });
      Object.defineProperty(list, "clientHeight", { value: 100, configurable: true });
      Object.defineProperty(list, "scrollTop", { value: 300, configurable: true });
      fireEvent.scroll(list);

      expect(screen.getByText("▲")).toBeInTheDocument();
      expect(screen.queryByText("▼")).not.toBeInTheDocument();
    });
  });

  describe("Selected toggle affects submission", () => {
    it("Project Control: submits the normal projectId scope when every pole remains selected (default)", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({ projectId: "rec123", brightness: 50, time: 30 });
    });

    it("Project Control: submits poleNumbers (by Leadsun's ProductName, not our own PoleNumber) for only the selected poles once any pole is deselected", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const toggles = screen.getAllByRole("switch");
      await user.click(toggles[0]); // deselect "12009-1001" (PROV-1)

      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({
        poleNumbers: ["12009-1002", "12009-2001"],
        brightness: 50,
        time: 30,
      });
    });

    it("Gateway Control: submits gatewayCode when every pole in that gateway remains selected", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstGatewayControl] = screen.getAllByRole("button", { name: "Gateway Control" });
      await user.click(firstGatewayControl);
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({
        gatewayCode: "GT18L94A25082883",
        brightness: 50,
        time: 30,
      });
    });

    it("Gateway Control: submits poleNumbers for only the selected poles once one is deselected, scoped to just that gateway's own poles", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstGatewayControl] = screen.getAllByRole("button", { name: "Gateway Control" });
      await user.click(firstGatewayControl);

      const [firstToggle] = screen.getAllByRole("switch");
      await user.click(firstToggle); // deselect "12009-1001" (PROV-1), the first pole in Ph3

      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({
        poleNumbers: ["12009-1002"],
        brightness: 50,
        time: 30,
      });
    });

    it("Light Control: grays out the submit button when the only pole is deselected", async () => {
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const [toggle] = screen.getAllByRole("switch");
      await user.click(toggle);

      expect(screen.getByRole("button", { name: "GO!" })).toBeDisabled();
    });

    it("Light Control: the submit button is enabled by default (the only pole starts selected)", async () => {
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      expect(screen.getByRole("button", { name: "GO!" })).not.toBeDisabled();
    });

    it("Light Control: re-enables the submit button once the only pole is reselected", async () => {
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const [toggle] = screen.getAllByRole("switch");
      await user.click(toggle);
      expect(screen.getByRole("button", { name: "GO!" })).toBeDisabled();

      await user.click(toggle);
      expect(screen.getByRole("button", { name: "GO!" })).not.toBeDisabled();
    });

    it("Project Control: grays out the submit button once every pole is deselected", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      for (const toggle of screen.getAllByRole("switch")) {
        await user.click(toggle);
      }

      expect(screen.getByRole("button", { name: "GO!" })).toBeDisabled();
    });

    it("polling only checks the poles actually submitted, not a deselected one that was never targeted by the request", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000, 8000]);
      mockFetchRouted({
        // PROV-1 (deselected, never submitted) stays off; PROV-2 and
        // PROV-3 (both submitted) are on — should still count as a
        // fully-confirmed match despite PROV-1 never changing.
        lamps: [
          makeLamp({ productId: "PROV-1", lampPower1: 0, lampPower2: 0 }),
          makeLamp({ productId: "PROV-2", lampPower1: 40, lampPower2: 0 }),
          makeLamp({ productId: "PROV-3", lampPower1: 40, lampPower2: 0 }),
        ],
      });
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      const [firstToggle] = screen.getAllByRole("switch");
      await user.click(firstToggle); // deselect PROV-1

      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000);

      // Confirmed on the very first poll — no PROV-1 wait, no error state.
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Project Control" })).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });
  });

  describe("GO!/TURN OFF submission", () => {
    it("aborts a hung status check after 8 seconds, treating it as a failed check rather than freezing the poll loop forever", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000, 8000]);
      const user = userEvent.setup();
      let capturedSignal: AbortSignal | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string, options?: { signal?: AbortSignal }) => {
          if (typeof url === "string" && url.includes("/api/setpolelights")) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  success: true,
                  message: "Request successful",
                  statusCode: "200",
                  data: null,
                }),
            });
          }
          // The initial fetch on modal open resolves normally; only the
          // poll's own fetch (the one carrying an abort signal) hangs.
          if (options?.signal) {
            capturedSignal = options.signal;
            return new Promise((_, reject) => {
              options.signal!.addEventListener("abort", () => {
                const err = new Error("The operation was aborted");
                err.name = "AbortError";
                reject(err);
              });
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }),
      );
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      // Trigger poll 1 without awaiting its full completion — it'll hang
      // on the fetch until the abort timer below is advanced, so awaiting
      // it directly here would deadlock.
      const pollCalls = setTimeoutSpy.mock.calls.filter(([, d]) => d === 1000);
      const pollCallback = pollCalls[pollCalls.length - 1][0] as () => Promise<void>;
      const pollPromise = pollCallback();
      // A couple microtask ticks so checkPolesMatch reaches its fetch call
      // and schedules its own 8000ms abort timer.
      await Promise.resolve();
      await Promise.resolve();

      // Still polling — the hung fetch hasn't been aborted yet.
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(capturedSignal?.aborted).toBe(false);

      // Advance the abort timeout — the hung fetch should be aborted,
      // treated as a failed (not matched) check, and the loop continues.
      await advanceScheduled(setTimeoutSpy, 8000);
      await act(async () => {
        await pollPromise;
      });

      expect(capturedSignal?.aborted).toBe(true);
      expect(screen.getByRole("status")).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });

    it("polling actually makes fetch calls under React Strict Mode (regression: Next.js dev defaults to Strict Mode, which double-invokes effects — mount, cleanup, mount again — and an unmounted-guard ref that isn't reset on the second mount stays permanently 'unmounted', silently no-oping every poll check from the very first attempt, with zero fetches ever made, regardless of whether the modal had actually closed)", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000, 8000]);
      const user = userEvent.setup();
      mockFetchRouted({ lamps: [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })] });
      render(
        <StrictMode>
          <RemoteControlLink
            projectId="rec123"
            leadsunProject={leadsunProject}
            product={product}
          />
        </StrictMode>,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      const fetchesBeforePoll = countLampStatusFetches();
      await advanceScheduled(setTimeoutSpy, 1000);

      // A real fetch must actually happen — under the bug this fixed, the
      // poll callback ran but silently no-op'd, leaving the count
      // unchanged and the spinner stuck forever.
      expect(countLampStatusFetches()).toBe(fetchesBeforePoll + 1);
      expect(screen.getByRole("status")).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });

    it("posts brightness/time and projectId (our internal id) for a project-level action", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({ projectId: "rec123", brightness: 50, time: 30 });
    });

    it("posts gatewayCode (Leadsun's GatewayCode) for a gateway-level action", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstGatewayControl] = screen.getAllByRole("button", { name: "Gateway Control" });
      await user.click(firstGatewayControl);
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({
        gatewayCode: "GT18L94A25082883",
        brightness: 50,
        time: 30,
      });
    });

    it("posts poleNumber using Leadsun's ProductName (not our own PoleNumber field) for a pole-level action", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      // product.ProductName is "12081-1102" — distinct from product.PoleNumber ("AEXSAP4323111877-A").
      expect(findSetPoleLightsBody()).toEqual({
        poleNumber: "12081-1102",
        brightness: 50,
        time: 30,
      });
    });

    it("posts the current Brightness/Time values, not always the defaults", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      fireEvent.change(screen.getByLabelText(/Brightness/), { target: { value: "80" } });
      fireEvent.change(screen.getByLabelText(/Time/), { target: { value: "120" } });
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(findSetPoleLightsBody()).toEqual({
        poleNumber: "12081-1102",
        brightness: 80,
        time: 120,
      });
    });

    it("posts with poleNumber (not brightness=0 special-cased) when TURN OFF is clicked", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      fireEvent.change(screen.getByLabelText(/Brightness/), { target: { value: "0" } });
      await user.click(screen.getByRole("button", { name: "TURN OFF" }));

      expect(findSetPoleLightsBody()).toEqual({
        poleNumber: "12081-1102",
        brightness: 0,
        time: 30,
      });
    });

    it("shows the server's success message after a successful submission", async () => {
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(await screen.findByText("Request successful")).toBeInTheDocument();
    });

    it("shows an error message when the server responds with success: false", async () => {
      mockFetchRouted({
        setPoleLightsResponse: {
          ok: true,
          body: { success: false, message: "Pole is offline", statusCode: "409", data: null },
        },
      });
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(await screen.findByText("Pole is offline")).toBeInTheDocument();
    });

    it("shows an error message when the request itself fails (non-2xx)", async () => {
      mockFetchRouted({ setPoleLightsResponse: { ok: false, body: { error: "Server error" } } });
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(await screen.findByText("Server error")).toBeInTheDocument();
    });

    it("disables the button and shows 'Submitting…' while the request is in flight", async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (typeof url === "string" && url.includes("/api/setpolelights")) {
            return new Promise((resolve) => {
              resolveFetch = resolve;
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
        }),
      );
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      const submittingButton = screen.getByRole("button", { name: "Submitting…" });
      expect(submittingButton).toBeDisabled();

      resolveFetch({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            message: "Request successful",
            statusCode: "200",
            data: null,
          }),
      });
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^Wait \d+s$/ })).toBeInTheDocument(),
      );
    });

    it("disables the button with a 10s countdown after a successful submission — even before the modal auto-closes", async () => {
      const setIntervalSpy = vi
        .spyOn(global, "setInterval")
        .mockImplementation((() => 0) as unknown as typeof setInterval);
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      const cooldownButton = screen.getByRole("button", { name: "Wait 10s" });
      expect(cooldownButton).toBeDisabled();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setIntervalSpy.mockRestore();
    });

    it("also applies the cooldown after a failed submission — a failed attempt still counts against Leadsun's rate limit", async () => {
      const setIntervalSpy = vi
        .spyOn(global, "setInterval")
        .mockImplementation((() => 0) as unknown as typeof setInterval);
      mockFetchRouted({ setPoleLightsResponse: { ok: false, body: { error: "Server error" } } });
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Server error")).toBeInTheDocument();

      expect(screen.getByRole("button", { name: "Wait 10s" })).toBeDisabled();

      setIntervalSpy.mockRestore();
    });

    it("counts down each second and re-enables the button once it reaches 0", async () => {
      let intervalCallback: () => void = () => {};
      const setIntervalSpy = vi
        .spyOn(global, "setInterval")
        .mockImplementation(((fn: () => void) => {
          intervalCallback = fn;
          return 0;
        }) as unknown as typeof setInterval);
      const clearIntervalSpy = vi.spyOn(global, "clearInterval").mockImplementation(() => {});
      mockFetchRouted({});
      const user = userEvent.setup();
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByRole("button", { name: "Wait 10s" })).toBeInTheDocument();

      for (let secondsLeft = 9; secondsLeft >= 1; secondsLeft -= 1) {
        act(() => intervalCallback());
        expect(screen.getByRole("button", { name: `Wait ${secondsLeft}s` })).toBeInTheDocument();
      }

      act(() => intervalCallback());
      expect(screen.getByRole("button", { name: "GO!" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "GO!" })).not.toBeDisabled();
      expect(clearIntervalSpy).toHaveBeenCalled();

      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it("shows a success message, then auto-closes the modal 2 seconds after a successful submission", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchRouted({});
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));

      expect(screen.getByText("Request successful")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Light Remote Control" })).toBeInTheDocument();

      // The 2000ms auto-close timer was scheduled but hasn't fired yet.
      await advanceScheduled(setTimeoutSpy, 2000);

      expect(
        screen.queryByRole("dialog", { name: "Light Remote Control" }),
      ).not.toBeInTheDocument();
      setTimeoutSpy.mockRestore();
    });

    it("replaces the trigger link with a spinner immediately on a successful submission, before the modal auto-closes", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchRouted({});
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      // The "Control" trigger inside the still-open modal is gone, replaced by a spinner.
      expect(screen.queryByRole("button", { name: "Control" })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
      setTimeoutSpy.mockRestore();
    });

    it("does not show a spinner or replace the trigger when the submission itself fails", async () => {
      const user = userEvent.setup();
      mockFetchRouted({ setPoleLightsResponse: { ok: false, body: { error: "Server error" } } });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      await screen.findByText("Server error");

      expect(screen.getByRole("button", { name: "Control" })).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("polls GET /api/leadsunlampstatus roughly every 1 second after a successful submission", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      // Never matches ON, so polling keeps going every time we advance it.
      mockFetchRouted({ lamps: [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })] });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const fetchesBeforeSubmit = countLampStatusFetches();

      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      expect(countLampStatusFetches()).toBe(fetchesBeforeSubmit);

      await advanceScheduled(setTimeoutSpy, 1000);
      expect(countLampStatusFetches()).toBe(fetchesBeforeSubmit + 1);

      await advanceScheduled(setTimeoutSpy, 1000);
      expect(countLampStatusFetches()).toBe(fetchesBeforeSubmit + 2);

      setTimeoutSpy.mockRestore();
    });

    it("stops polling and restores the normal trigger link once the light's status actually matches what was requested", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchSequenced({
        lampSequence: [
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // initial fetch on modal open — irrelevant to this test
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // poll 1: still off
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // poll 2: still off
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 45, lampPower2: 0 })], // poll 3: now on — matches GO!
        ],
      });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 1: still off
      expect(screen.getByRole("status")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 2: still off
      expect(screen.getByRole("status")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 3: now on — matches
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Control" })).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });

    it("refreshes the outer Remote Control modal's own status display once a control action is confirmed", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchSequenced({
        lampSequence: [
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // initial fetch on modal open — irrelevant to this test
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // poll 1: still off
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 45, lampPower2: 0 })], // poll 2: now on — matches
        ],
      });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const fetchesBeforeSubmit = countLampStatusFetches();

      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 1: still off, not yet confirmed
      await advanceScheduled(setTimeoutSpy, 1000); // poll 2: now on — confirms the change

      // The outer modal's own indicator re-fetch (triggered via onActionSubmitted).
      expect(countLampStatusFetches()).toBe(fetchesBeforeSubmit + 3);

      setTimeoutSpy.mockRestore();
    });

    it("treats brightness=0 (TURN OFF) as expecting OFF, not ON, when checking for a confirmed change", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchSequenced({
        lampSequence: [
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 60, lampPower2: 0 })], // initial fetch on modal open — irrelevant to this test
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 60, lampPower2: 0 })], // poll 1: still on
          [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })], // poll 2: now off — matches TURN OFF
        ],
      });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      fireEvent.change(screen.getByLabelText(/Brightness/), { target: { value: "0" } });
      await user.click(screen.getByRole("button", { name: "TURN OFF" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 1: still on, doesn't match OFF
      expect(screen.getByRole("status")).toBeInTheDocument();

      await advanceScheduled(setTimeoutSpy, 1000); // poll 2: now off, matches
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });

    it("shows a retryable error after 15 poll attempts without a confirmed status change", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      // Never matches ON, no matter how many times it's checked.
      mockFetchRouted({ lamps: [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })] });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      for (let i = 0; i < 15; i += 1) {
        await advanceScheduled(setTimeoutSpy, 1000);
      }

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Didn.t confirm/ })).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });

    it("stops polling once the error state is reached — no further fetches beyond the 15th attempt", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchRouted({ lamps: [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })] });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      for (let i = 0; i < 15; i += 1) {
        await advanceScheduled(setTimeoutSpy, 1000);
      }
      const fetchesAtError = countLampStatusFetches();

      // No 16th poll was ever scheduled — nothing left to advance.
      const pollCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 1000);
      expect(pollCalls).toHaveLength(15);
      expect(countLampStatusFetches()).toBe(fetchesAtError);

      setTimeoutSpy.mockRestore();
    });

    it("clicking the retryable error resets back to the normal trigger link, allowing the modal to reopen", async () => {
      const setTimeoutSpy = mockSetTimeoutIntercepting([2000, 1000]);
      const user = userEvent.setup();
      mockFetchRouted({ lamps: [makeLamp({ productId: "AEXSAP4323111877", lampPower1: 0, lampPower2: 0 })] });
      render(
        <RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));
      await user.click(screen.getByRole("button", { name: "GO!" }));
      expect(screen.getByText("Request successful")).toBeInTheDocument();

      for (let i = 0; i < 15; i += 1) {
        await advanceScheduled(setTimeoutSpy, 1000);
      }
      await user.click(screen.getByRole("button", { name: /Didn.t confirm/ }));

      expect(screen.getByRole("button", { name: "Control" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Control" }));
      expect(screen.getByRole("dialog", { name: "Light Remote Control" })).toBeInTheDocument();

      setTimeoutSpy.mockRestore();
    });
  });

  describe("Control Action form (Brightness/Time/GO!)", () => {
    it("defaults Brightness to 50 and Time to 30", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      expect(screen.getByText("Brightness (50)")).toBeInTheDocument();
      const timeInput = screen.getByLabelText(/Time/) as HTMLInputElement;
      expect(timeInput.value).toBe("30");
    });

    it("shows GO! as the button label by default", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      expect(screen.getByRole("button", { name: "GO!" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "TURN OFF" })).not.toBeInTheDocument();
    });

    it("changes the button label to TURN OFF when Brightness is set to 0", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const brightnessInput = screen.getByLabelText(/Brightness/) as HTMLInputElement;
      fireEvent.change(brightnessInput, { target: { value: "0" } });

      expect(screen.getByRole("button", { name: "TURN OFF" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "GO!" })).not.toBeInTheDocument();
    });

    it("switches back to GO! once Brightness is raised above 0 again", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const brightnessInput = screen.getByLabelText(/Brightness/) as HTMLInputElement;
      fireEvent.change(brightnessInput, { target: { value: "0" } });
      expect(screen.getByRole("button", { name: "TURN OFF" })).toBeInTheDocument();

      fireEvent.change(brightnessInput, { target: { value: "75" } });
      expect(screen.getByRole("button", { name: "GO!" })).toBeInTheDocument();
    });

    it("has independent form state per Control Action instance", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstPoleControl, secondPoleControl] = screen.getAllByRole("button", {
        name: "Control",
      });

      await user.click(firstPoleControl);
      const firstBrightness = screen.getByLabelText(/Brightness/) as HTMLInputElement;
      fireEvent.change(firstBrightness, { target: { value: "0" } });
      expect(screen.getByRole("button", { name: "TURN OFF" })).toBeInTheDocument();

      // Close just the first pole's Control Action modal (scoped by its own
      // dialog, since both it and the outer Remote Control modal have a
      // Close button while both are open), then open the second — its own
      // Brightness should still be at the default, unaffected by the first.
      const firstControlDialog = screen
        .getByRole("heading", { name: "Light Remote Control" })
        .closest('[role="dialog"]') as HTMLElement;
      await user.click(within(firstControlDialog).getByRole("button", { name: "Close" }));
      await user.click(secondPoleControl);
      expect(screen.getByRole("button", { name: "GO!" })).toBeInTheDocument();
    });
  });

  describe("pole mode (product given)", () => {
    it("shows the product's ProductName and ProvidedProductId, and nothing else", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("12081-1102")).toBeInTheDocument();
      expect(within(dialog).getByText("AEXSAP4323111877")).toBeInTheDocument();
      expect(within(dialog).queryByText(/Gateway/)).not.toBeInTheDocument();
      expect(within(dialog).queryByText("Chaparral")).not.toBeInTheDocument();
    });

    it("uses a narrow modal width", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      expect(screen.getByRole("dialog").className).toContain("max-w-[420px]");
    });

    it("shows the indicator right alongside the ProductName heading", async () => {
      mockFetchOnce([makeLamp({ productId: "AEXSAP4323111877", lampPower1: 10, lampPower2: 0 })]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const heading = screen.getByRole("heading", { name: "12081-1102" });
      const onLabel = await screen.findByText("ON");
      expect(heading.parentElement).toContainElement(onLabel);
    });

    it("shows a 'Control' stub link inline right after the dot/ON-OFF indicator, not below it", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const controlButton = screen.getByRole("button", { name: "Control" });
      expect(controlButton).toBeInTheDocument();
      // Sibling of the indicator, in the same wrapper — not a separate row underneath.
      const indicator = await waitFor(() => screen.getByText("—"));
      expect(indicator.parentElement).toBe(controlButton.parentElement);
    });

    it("opens a 'Light Remote Control' modal with a Brightness/Time form when the 'Control' link is clicked, on top of the Remote Control modal", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const dialogs = screen.getAllByRole("dialog");
      expect(dialogs).toHaveLength(2);
      expect(screen.getByRole("heading", { name: "Light Remote Control" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "GO!" })).toBeInTheDocument();
    });

    it("closing the 'Control Action' modal leaves the Remote Control modal open", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} product={product} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Control" }));

      const controlActionDialog = screen.getByRole("heading", { name: "Light Remote Control" })
        .closest('[role="dialog"]') as HTMLElement;
      await user.click(within(controlActionDialog).getByRole("button", { name: "Close" }));

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("heading", { name: product.ProductName })).toBeInTheDocument();
    });
  });

  describe("project mode (no product given)", () => {
    it("shows the header: ProjectName, total gateways, and total lights", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Chaparral")).toBeInTheDocument();
      expect(within(dialog).getByText(/2 Gateways/)).toBeInTheDocument();
      expect(within(dialog).getByText(/5 Lights/)).toBeInTheDocument();
    });

    it("shows a card per gateway (group) with its name, code, and light count", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Chaparral Ph3")).toBeInTheDocument();
      expect(within(dialog).getByText("GT18L94A25082883")).toBeInTheDocument();
      expect(within(dialog).getByText("3 Lights")).toBeInTheDocument();
      expect(within(dialog).getByText("Chaparral Ph4")).toBeInTheDocument();
      expect(within(dialog).getByText("GT18L94A25082884")).toBeInTheDocument();
      expect(within(dialog).getByText("2 Lights")).toBeInTheDocument();
    });

    it("lists each gateway's own poles with ProductName and ProvidedProductId", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      // Chaparral Ph3's poles.
      expect(within(dialog).getByText("12009-1001")).toBeInTheDocument();
      expect(within(dialog).getByText("PROV-1")).toBeInTheDocument();
      expect(within(dialog).getByText("12009-1002")).toBeInTheDocument();
      expect(within(dialog).getByText("PROV-2")).toBeInTheDocument();
      // Chaparral Ph4's pole.
      expect(within(dialog).getByText("12009-2001")).toBeInTheDocument();
      expect(within(dialog).getByText("PROV-3")).toBeInTheDocument();
    });

    it("keeps each gateway's poles within that gateway's own card, not mixed together", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const ph3Card = screen.getByText("Chaparral Ph3").closest("div") as HTMLElement;
      expect(within(ph3Card).getByText("12009-1001")).toBeInTheDocument();
      expect(within(ph3Card).getByText("12009-1002")).toBeInTheDocument();
      expect(within(ph3Card).queryByText("12009-2001")).not.toBeInTheDocument();
    });

    it("lays out gateway cards in a 4-column grid, so a 5th card wraps to a new row", async () => {
      const fiveGatewayProject: LeadsunProject = {
        ...leadsunProject,
        totalGateways: 5,
        groups: [
          ...leadsunProject.groups,
          { GroupId: 1151, GroupName: "Gateway 3", GatewayCode: "GW3", totalPoles: 0, products: [] },
          { GroupId: 1152, GroupName: "Gateway 4", GatewayCode: "GW4", totalPoles: 0, products: [] },
          { GroupId: 1153, GroupName: "Gateway 5", GatewayCode: "GW5", totalPoles: 0, products: [] },
        ],
      };
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={fiveGatewayProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const grid = screen.getByText("Chaparral Ph3").closest("div")?.parentElement;
      expect(grid?.className).toContain("grid-cols-4");
      expect(grid?.children).toHaveLength(5);
    });

    it("uses a wide, scrollable modal to fit the gateway grid", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-4xl");
      expect(dialog.className).toContain("overflow-y-auto");
    });

    it("uses singular 'Gateway'/'Light' wording for a count of exactly 1", async () => {
      const oneOfEachProject: LeadsunProject = {
        ProjectId: "1",
        ProjectName: "Solo Project",
        totalGateways: 1,
        totalPoles: 1,
        groups: [
          {
            GroupId: 1,
            GroupName: "Only Gateway",
            GatewayCode: "GW1",
            totalPoles: 1,
            products: [product],
          },
        ],
      };
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={oneOfEachProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("1 Gateway · 1 Light")).toBeInTheDocument();
    });

    it("shows each pole's own indicator, matched by ProvidedProductId, independently of the others", async () => {
      mockFetchOnce([
        makeLamp({ productId: "PROV-1", lampPower1: 50, lampPower2: 0 }), // on
        makeLamp({ productId: "PROV-2", lampPower1: 0, lampPower2: 0 }), // off
        // PROV-3 intentionally omitted — unknown/no data.
      ]);
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      await waitFor(() => {
        expect(screen.getByText("ON")).toBeInTheDocument();
        expect(screen.getByText("OFF")).toBeInTheDocument();
        expect(screen.getByText("—")).toBeInTheDocument();
      });
    });

    it("shows a 'Project Control' link inline right after the Gateways/Lights count, not right-aligned", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const countLine = screen.getByText(/2 Gateways/).closest("div") as HTMLElement;
      const controlButton = within(countLine).getByRole("button", { name: "Project Control" });
      expect(controlButton).toBeInTheDocument();
      // Genuinely the same inline flow, not a separate flex item pushed to
      // the far right via justify-between.
      expect(countLine.className).not.toContain("justify-between");
      expect(countLine.textContent).toMatch(/2 Gateways.*5 Lights.*Project Control/);
    });

    it("opens a 'Project Remote Control' modal listing every pole across all gateways when 'Project Control' is clicked", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      await user.click(screen.getByRole("button", { name: "Project Control" }));

      expect(screen.getAllByRole("dialog")).toHaveLength(2);
      expect(
        screen.getByRole("heading", { name: "Project Remote Control" }),
      ).toBeInTheDocument();
      expect(screen.getByText("3 poles affected")).toBeInTheDocument();
      const columnHeaders = screen.getAllByRole("columnheader");
      expect(columnHeaders.map((h) => h.textContent)).toEqual([
        "Gateway",
        "Pole Number",
        "Selected",
      ]);
      // All 3 poles, across both gateways, each with the right gateway name
      // — plus the underlying Remote Control modal's own gateway card
      // titles, which stay in the DOM (just visually layered behind).
      expect(screen.getAllByText("Chaparral Ph3")).toHaveLength(3);
      expect(screen.getAllByText("Chaparral Ph4")).toHaveLength(2);
      expect(screen.getByText("PROV-1-A")).toBeInTheDocument();
      expect(screen.getByText("PROV-2-A")).toBeInTheDocument();
      expect(screen.getByText("PROV-3-A")).toBeInTheDocument();
    });

    it("shows a 'Gateway Control' link inline right after each gateway's own light count, not right-aligned", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const ph3Card = screen.getByText("Chaparral Ph3").closest("div") as HTMLElement;
      const ph4Card = screen.getByText("Chaparral Ph4").closest("div") as HTMLElement;
      expect(within(ph3Card).getByRole("button", { name: "Gateway Control" })).toBeInTheDocument();
      expect(within(ph4Card).getByRole("button", { name: "Gateway Control" })).toBeInTheDocument();

      const ph3CountLine = screen.getByText("3 Lights").closest("div") as HTMLElement;
      expect(within(ph3CountLine).getByRole("button", { name: "Gateway Control" })).toBeInTheDocument();
      expect(ph3CountLine.className).not.toContain("justify-between");
      expect(ph3CountLine.textContent).toBe("3 LightsGateway Control");
    });

    it("opens a 'Gateway Remote Control' modal listing just that gateway's own poles when a 'Gateway Control' link is clicked", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstGatewayControl] = screen.getAllByRole("button", { name: "Gateway Control" });
      await user.click(firstGatewayControl);

      expect(screen.getAllByRole("dialog")).toHaveLength(2);
      expect(
        screen.getByRole("heading", { name: "Gateway Remote Control" }),
      ).toBeInTheDocument();
      // Ph3 (the first gateway) has 2 poles — not Ph4's 1 pole.
      expect(screen.getByText("2 poles affected")).toBeInTheDocument();
      expect(screen.getByText("PROV-1-A")).toBeInTheDocument();
      expect(screen.getByText("PROV-2-A")).toBeInTheDocument();
      expect(screen.queryByText("PROV-3-A")).not.toBeInTheDocument();
    });

    it("shows a 'Control' link inline right after the dot/ON-OFF indicator on each pole row, not below it", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));

      const controlButtons = screen.getAllByRole("button", { name: "Control" });
      expect(controlButtons).toHaveLength(3);
      // Each is a sibling of its own row's indicator, in the same wrapper.
      const firstIndicator = await waitFor(() => screen.getAllByText("—")[0]);
      expect(firstIndicator.parentElement).toBe(controlButtons[0].parentElement);
    });

    it("opens a 'Light Remote Control' modal listing just that one pole, per pole row", async () => {
      const user = userEvent.setup();
      render(<RemoteControlLink projectId="rec123" leadsunProject={leadsunProject} />);
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      const [firstPoleControl] = screen.getAllByRole("button", { name: "Control" });
      await user.click(firstPoleControl);

      expect(screen.getAllByRole("dialog")).toHaveLength(2);
      expect(screen.getByRole("heading", { name: "Light Remote Control" })).toBeInTheDocument();
      expect(screen.getByText("1 pole affected")).toBeInTheDocument();
      expect(screen.getByText("PROV-1-A")).toBeInTheDocument();
      expect(screen.queryByText("PROV-2-A")).not.toBeInTheDocument();
    });
  });
});
