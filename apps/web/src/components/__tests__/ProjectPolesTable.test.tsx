import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectPolesTable } from "@/components/ProjectPolesTable";
import type { LeadsunProject, PoleVital } from "@/lib/types";

const defaultProps = { customerId: "cust-1", projectId: "proj-1" };

/** A timestamp within the last 48h — isSilentPole compares against the real current time. */
function recentTimestamp(hoursAgo = 1): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

describe("ProjectPolesTable", () => {
  const poles: PoleVital[] = [
    { id: "p1", poleNumber: "51079-1000", locationId: "loc-1", active: true, isOnline: true, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: "Online", overallStatusText: "OK", isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
    { id: "p2", poleNumber: "51079-1001", locationId: "loc-2", active: true, isOnline: true, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: "Online", overallStatusText: "OK", isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
    { id: "p3", poleNumber: "51079-1002", locationId: "loc-3", active: true, isOnline: false, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: "Offline", overallStatusText: "Fault", isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
    { id: "p4", poleNumber: "51079-1003", locationId: "loc-4", active: true, isOnline: null, installDate: null, lat: null, long: null, lastUpdate: null, batteryVoltage1: null, batteryVoltage2: null, lampPower1: null, lampPower2: null, batteryElecCurrent1: null, batteryElecCurrent2: null, solarBoardVoltage: null, solarBoardElecCurrent: null, avgBatteryPercentage: null, avgPanelPercentage: null, avgLightPercentage: null, sunsetTime: null, lightStatusText: null, panelStatusText: null, panelIdleReason: null, batteryStatusText: null, electricCurrentAverage: null, connectedText: "Unknown", overallStatusText: null, isLedFault: null, isBatteryFault: null, isPanelFault: null, isOpenIssueFault: null, isPoleFault: null, poleIssues: [] },
  ];

  it("renders a row per pole, showing connectedText directly (not computed)", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.getByText("51079-1000")).toBeInTheDocument();
    const onlineSpans = screen
      .getAllByText("Online")
      .filter((el) => el.className.includes("status-active"));
    expect(onlineSpans).toHaveLength(2);
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("does not render a Working/Light Status column", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.queryByRole("columnheader", { name: "Working" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Light Status" })).not.toBeInTheDocument();
  });

  it("renders a 48h Overall Status column", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.getByRole("columnheader", { name: "48h Overall Status" })).toBeInTheDocument();
  });

  it("shows a dash (no color) when connectedText/overallStatusText are null, rather than computing a fallback", () => {
    const poleWithNoLabels = { ...poles[0], connectedText: null, overallStatusText: null };
    render(<ProjectPolesTable poles={[poleWithNoLabels]} {...defaultProps} />);

    const row = screen.getByRole("row", { name: /51079-1000/ });
    const cells = row.querySelectorAll("td");
    // Pole Number, 48h Connected, 48h Overall Status — the first two data cells.
    expect(cells[1]).toHaveTextContent("—");
    expect(cells[1].className).not.toContain("status-active");
    expect(cells[1].className).not.toContain("status-flagged");
    expect(cells[2]).toHaveTextContent("—");
    expect(cells[2].className).not.toContain("status-active");
    expect(cells[2].className).not.toContain("status-flagged");
  });

  it("shows overallStatusText 'OK' in green, exactly as the API sends it", () => {
    const polesWithStatus = [{ ...poles[0], overallStatusText: "OK" }];
    render(<ProjectPolesTable poles={polesWithStatus} {...defaultProps} />);

    const ok = screen.getByText("OK");
    expect(ok.className).toContain("text-[var(--status-active)]");
  });

  it("shows overallStatusText 'Fault' in red, exactly as the API sends it", () => {
    const polesWithStatus = [{ ...poles[0], overallStatusText: "Fault" }];
    render(<ProjectPolesTable poles={polesWithStatus} {...defaultProps} />);

    const fault = screen.getByText("Fault");
    expect(fault.className).toContain("text-[var(--status-flagged)]");
  });

  it("shows overallStatusText 'Not Reporting 48H' in dark-gray (not green/red, and not the lighter neutral used for a true dash/unknown)", () => {
    const polesWithStatus = [{ ...poles[0], overallStatusText: "Not Reporting 48H" }];
    render(<ProjectPolesTable poles={polesWithStatus} {...defaultProps} />);

    const label = screen.getByText("Not Reporting 48H");
    expect(label.className).toContain("text-[var(--ink-muted)]");
    expect(label.className).not.toContain("status-active");
    expect(label.className).not.toContain("status-flagged");
  });

  it("shows connectedText 'Online' in green, exactly as the API sends it", () => {
    render(<ProjectPolesTable poles={[poles[0]]} {...defaultProps} />);
    const onlineCell = screen.getByText("Online");
    expect(onlineCell.className).toContain("text-[var(--status-active)]");
    expect(onlineCell.querySelector("span[aria-hidden]")).toBeFalsy();
  });

  it("shows a colored dot next to the pole number, matching isOnline (same as the top-level Poles list) — independent of connectedText", () => {
    render(<ProjectPolesTable poles={[poles[0], poles[2], poles[3]]} {...defaultProps} />);
    const onlineLink = screen.getByRole("link", { name: "51079-1000" }); // isOnline: true
    const offlineLink = screen.getByRole("link", { name: "51079-1002" }); // isOnline: false
    const unknownLink = screen.getByRole("link", { name: "51079-1003" }); // isOnline: null
    expect(onlineLink.querySelector("span[aria-hidden]")?.className).toContain(
      "bg-[var(--status-active)]",
    );
    expect(offlineLink.querySelector("span[aria-hidden]")?.className).toContain(
      "bg-[var(--status-flagged)]",
    );
    expect(unknownLink.querySelector("span[aria-hidden]")?.className).toContain(
      "bg-[var(--ink-faint)]",
    );
  });

  it("shows connectedText 'Offline' in red, exactly as the API sends it", () => {
    render(<ProjectPolesTable poles={[poles[2]]} {...defaultProps} />);
    const offlineCell = screen.getByText("Offline");
    expect(offlineCell.className).toContain("text-[var(--status-flagged)]");
  });

  it("shows connectedText 'Disconnected' in red, exactly as the API sends it", () => {
    const disconnectedPole = { ...poles[0], connectedText: "Disconnected" };
    render(<ProjectPolesTable poles={[disconnectedPole]} {...defaultProps} />);
    const cell = screen.getByText("Disconnected");
    expect(cell.className).toContain("text-[var(--status-flagged)]");
  });

  it("shows connectedText 'Unknown' in a neutral color (not green/red)", () => {
    render(<ProjectPolesTable poles={[poles[3]]} {...defaultProps} />);
    const cell = screen.getByText("Unknown");
    expect(cell.className).toContain("text-[var(--ink-faint)]");
    expect(cell.className).not.toContain("status-active");
    expect(cell.className).not.toContain("status-flagged");
  });

  it("does not show Online or Offline text when connectedText is Unknown", () => {
    render(<ProjectPolesTable poles={[poles[3]]} {...defaultProps} />);
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Online")).toHaveLength(0);
  });

  it("links the pole number to the pole detail page", () => {
    render(<ProjectPolesTable poles={[poles[0]]} {...defaultProps} />);
    const link = screen.getByRole("link", { name: "51079-1000" });
    expect(link).toHaveAttribute("href", "/customers/cust-1/projects/proj-1/poles/p1");
  });

  it("carries the ?cust_q= search param into the pole link", () => {
    render(<ProjectPolesTable poles={[poles[0]]} {...defaultProps} custQ="coastal" />);
    const link = screen.getByRole("link", { name: "51079-1000" });
    expect(link).toHaveAttribute(
      "href",
      "/customers/cust-1/projects/proj-1/poles/p1?cust_q=coastal",
    );
  });

  it("carries the ?pole_q= search param into the pole link", () => {
    render(<ProjectPolesTable poles={[poles[0]]} {...defaultProps} poleQ="12057" />);
    const link = screen.getByRole("link", { name: "51079-1000" });
    expect(link).toHaveAttribute(
      "href",
      "/customers/cust-1/projects/proj-1/poles/p1?pole_q=12057",
    );
  });

  it("carries both cust_q and pole_q together when both are present", () => {
    render(
      <ProjectPolesTable
        poles={[poles[0]]}
        {...defaultProps}
        custQ="coastal"
        poleQ="12057"
      />,
    );
    const link = screen.getByRole("link", { name: "51079-1000" });
    expect(link).toHaveAttribute(
      "href",
      "/customers/cust-1/projects/proj-1/poles/p1?cust_q=coastal&pole_q=12057",
    );
  });

  it("shows an empty-state message when there are no poles", () => {
    render(<ProjectPolesTable poles={[]} {...defaultProps} />);
    expect(screen.getByText("No poles on file for this project yet.")).toBeInTheDocument();
  });

  it("does not render pagination controls when there are no poles", () => {
    render(<ProjectPolesTable poles={[]} {...defaultProps} />);
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("paginates at 10 rows per page", async () => {
    const many: PoleVital[] = Array.from({ length: 25 }, (_, i) => ({
      id: `pole-id-${i + 1}`,
      poleNumber: `pole-${i + 1}`,
      locationId: `loc-${i + 1}`,
      active: true,
      isOnline: true,
      installDate: null,
      lat: null,
      long: null,
      lastUpdate: null,
      batteryVoltage1: null,
      batteryVoltage2: null,
      lampPower1: null,
      lampPower2: null,
      batteryElecCurrent1: null,
      batteryElecCurrent2: null,
      solarBoardVoltage: null,
      solarBoardElecCurrent: null,
      avgBatteryPercentage: null,
      avgPanelPercentage: null,
      avgLightPercentage: null,
      sunsetTime: null,
      lightStatusText: null,
      panelStatusText: null,
      panelIdleReason: null,
      batteryStatusText: null,
      electricCurrentAverage: null, connectedText: null, overallStatusText: null,
      isLedFault: null,
      isBatteryFault: null,
      isPanelFault: null,
      isOpenIssueFault: null,
      isPoleFault: null, poleIssues: [],
    }));
    const user = userEvent.setup();
    render(<ProjectPolesTable poles={many} {...defaultProps} />);

    // 10 data rows + 1 header row
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.getByText("pole-1")).toBeInTheDocument();
    expect(screen.queryByText("pole-11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("pole-11")).toBeInTheDocument();
    expect(screen.queryByText("pole-1")).not.toBeInTheDocument();
  });

  it("renders Light, Panel, and Battery column headers", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.getByRole("columnheader", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Panel" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Battery" })).toBeInTheDocument();
  });

  it("hides the 48h Connected column entirely when customerScoped is true", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} customerScoped />);
    expect(screen.queryByRole("columnheader", { name: "48h Connected" })).not.toBeInTheDocument();
    expect(screen.queryByText("Online")).not.toBeInTheDocument();
    expect(screen.queryByText("Offline")).not.toBeInTheDocument();
  });

  it("shows the 48h Connected column by default (customerScoped defaults to false)", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.getByRole("columnheader", { name: "48h Connected" })).toBeInTheDocument();
  });

  it("labels the status column 'Overall Status' (no '48h' prefix) when customerScoped is true", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} customerScoped />);
    expect(screen.getByRole("columnheader", { name: "Overall Status" })).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "48h Overall Status" }),
    ).not.toBeInTheDocument();
  });

  it("labels the status column '48h Overall Status' by default", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} />);
    expect(screen.getByRole("columnheader", { name: "48h Overall Status" })).toBeInTheDocument();
  });

  it("still shows Light/Panel/Battery columns when customerScoped is true", () => {
    render(<ProjectPolesTable poles={poles} {...defaultProps} customerScoped />);
    expect(screen.getByRole("columnheader", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Panel" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Battery" })).toBeInTheDocument();
  });

  it("shows lightStatusText exactly as the API sends it, including 'Not Reporting'/'Not Reporting 48H' — no longer computed from lastUpdate", () => {
    const pole = { ...poles[0], lightStatusText: "Not Reporting 48H" };
    render(<ProjectPolesTable poles={[pole]} {...defaultProps} />);
    expect(screen.getByText("Not Reporting 48H")).toBeInTheDocument();
  });

  it("does not recompute the Light label from lastUpdate — a recent lastUpdate does not override a 'Not Reporting 48H' lightStatusText", () => {
    const pole = {
      ...poles[0],
      lastUpdate: recentTimestamp(1),
      lightStatusText: "Not Reporting 48H",
    };
    render(<ProjectPolesTable poles={[pole]} {...defaultProps} />);
    expect(screen.getByText("Not Reporting 48H")).toBeInTheDocument();
  });

  it("does not strip '48H' from the Light label for a customerScoped viewer — that was the old client-side computation's job, the API's label is shown as-is", () => {
    const pole = { ...poles[0], lightStatusText: "Not Reporting 48H" };
    render(<ProjectPolesTable poles={[pole]} {...defaultProps} customerScoped />);
    expect(screen.getByText("Not Reporting 48H")).toBeInTheDocument();
  });

  it("shows the real lightStatusText in the Light column", () => {
    const activePole = { ...poles[0], lightStatusText: "OFF" };
    render(<ProjectPolesTable poles={[activePole]} {...defaultProps} />);
    expect(screen.getByText("OFF")).toBeInTheDocument();
  });

  it("shows a dash in the Light column when lightStatusText is null", () => {
    const pole = { ...poles[0], lightStatusText: null };
    render(<ProjectPolesTable poles={[pole]} {...defaultProps} />);
    const row = screen.getByText("51079-1000").closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    // Pole Number, 48h Connected, 48h Overall Status, Light, Panel, Battery.
    expect(cells[3]).toHaveTextContent("—");
  });

  it("appends the idle reason in parentheses in the Panel column when panelStatusText is Idle", () => {
    const idlePole = { ...poles[0], panelStatusText: "Idle", panelIdleReason: "Battery Full" };
    render(<ProjectPolesTable poles={[idlePole]} {...defaultProps} />);
    expect(screen.getByText("Idle (Battery Full)")).toBeInTheDocument();
  });

  it("does not append a parenthetical in the Panel column when panelStatusText is Idle but there's no reason given", () => {
    const idlePole = { ...poles[0], panelStatusText: "Idle", panelIdleReason: null };
    render(<ProjectPolesTable poles={[idlePole]} {...defaultProps} />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.queryByText(/Idle \(/)).not.toBeInTheDocument();
  });

  it("does not append the idle reason in the Panel column for a non-Idle panelStatusText, even if panelIdleReason happens to be set", () => {
    const chargingPole = {
      ...poles[0],
      panelStatusText: "Charging",
      panelIdleReason: "Battery Full",
    };
    render(<ProjectPolesTable poles={[chargingPole]} {...defaultProps} />);
    expect(screen.getByText("Charging")).toBeInTheDocument();
    expect(screen.queryByText(/Charging \(/)).not.toBeInTheDocument();
  });

  it("shows a dash in the Panel column when panelStatusText is null", () => {
    const noPanelData = { ...poles[0], panelStatusText: null, panelIdleReason: null };
    render(<ProjectPolesTable poles={[noPanelData]} {...defaultProps} />);
    const row = screen.getByText("51079-1000").closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    expect(cells[4]).toHaveTextContent("—");
  });

  it("shows the real batteryStatusText in the Battery column", () => {
    const fullBattery = { ...poles[0], batteryStatusText: "Full" };
    render(<ProjectPolesTable poles={[fullBattery]} {...defaultProps} />);
    expect(screen.getByText("Full")).toBeInTheDocument();
  });

  it("shows a dash in the Battery column when batteryStatusText is null", () => {
    const noBatteryData = { ...poles[0], batteryStatusText: null };
    render(<ProjectPolesTable poles={[noBatteryData]} {...defaultProps} />);
    const row = screen.getByText("51079-1000").closest("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");
    expect(cells[5]).toHaveTextContent("—");
  });

  describe("Actions column (Remote Control)", () => {
    const leadsunProject: LeadsunProject = {
      ProjectId: "545",
      ProjectName: "Manatee County - Buffalo Creek",
      totalGateways: 1,
      totalPoles: 1,
      groups: [
        {
          GroupId: 1263,
          GroupName: "Buffalo Creek",
          GatewayCode: "GT12L94A2310260A",
          totalPoles: 1,
          products: [
            {
              ProductId: 12548,
              ProductName: "loc-1",
              ProvidedProductId: "AEXSAP4323111877",
              PoleNumber: "AEXSAP4323111877-A",
            },
          ],
        },
      ],
    };

    it("does not render an Actions column when no leadsunProject is given", () => {
      render(<ProjectPolesTable poles={poles} {...defaultProps} />);
      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).not.toBeInTheDocument();
    });

    it("does not render an Actions column when leadsunProject has no products at all", () => {
      render(
        <ProjectPolesTable
          poles={poles}
          {...defaultProps}
          leadsunProject={{ ...leadsunProject, groups: [] }}
        />,
      );
      expect(
        screen.queryByRole("columnheader", { name: "Actions" }),
      ).not.toBeInTheDocument();
    });

    it("shows the Actions column when at least one pole's locationId matches a product", () => {
      render(
        <ProjectPolesTable poles={poles} {...defaultProps} leadsunProject={leadsunProject} />,
      );
      expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    });

    it("shows a Remote Control link only on the row whose locationId matches, blank on the rest", () => {
      render(
        <ProjectPolesTable poles={poles} {...defaultProps} leadsunProject={leadsunProject} />,
      );
      const matchingRow = screen.getByText("51079-1000").closest("tr") as HTMLElement;
      const otherRow = screen.getByText("51079-1001").closest("tr") as HTMLElement;
      expect(within(matchingRow).getByRole("button", { name: "Remote Control" })).toBeInTheDocument();
      expect(
        within(otherRow).queryByRole("button", { name: "Remote Control" }),
      ).not.toBeInTheDocument();
      // The cell itself is still present (blank), so columns still line up.
      expect(otherRow.querySelectorAll("td")).toHaveLength(
        matchingRow.querySelectorAll("td").length,
      );
    });

    it("opens the stub Remote Control modal when clicked", async () => {
      const user = userEvent.setup();
      render(
        <ProjectPolesTable poles={poles} {...defaultProps} leadsunProject={leadsunProject} />,
      );
      await user.click(screen.getByRole("button", { name: "Remote Control" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("left-aligns the Actions cell, matching the other columns (no text-right)", () => {
      render(
        <ProjectPolesTable poles={poles} {...defaultProps} leadsunProject={leadsunProject} />,
      );
      const matchingRow = screen.getByText("51079-1000").closest("tr") as HTMLElement;
      const actionsCell = matchingRow.querySelector("td:last-child");
      expect(actionsCell?.className).not.toContain("text-right");
    });

    it("uses the accent color for the Remote Control link", () => {
      render(
        <ProjectPolesTable poles={poles} {...defaultProps} leadsunProject={leadsunProject} />,
      );
      const link = screen.getByRole("button", { name: "Remote Control" });
      expect(link.className).toContain("text-[var(--accent)]");
      expect(link.className).not.toContain("--accent-ink");
    });
  });
});
