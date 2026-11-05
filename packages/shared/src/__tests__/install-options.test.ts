import { describe, expect, it } from "vitest";
import { remainingInstallOptions, stickerKey } from "../install-options";

const projects = [
  { id: "p1", name: "Spine Road", customerName: "Coastal", stickerNumbers: ["CHA-1157", "CHA-1158"] },
  { id: "p2", name: "Alpha Street", customerName: "Babcock", stickerNumbers: ["BAB-1"] },
];

describe("remainingInstallOptions", () => {
  it("leaves out stickers already submitted", () => {
    const left = remainingInstallOptions(projects, new Set([stickerKey("p1", "CHA-1157")]));
    expect(left.map((p) => [p.id, p.stickerNumbers])).toEqual([
      ["p1", ["CHA-1158"]],
      ["p2", ["BAB-1"]],
    ]);
  });

  it("drops a project once all its stickers are submitted", () => {
    const left = remainingInstallOptions(projects, new Set([stickerKey("p2", "BAB-1")]));
    expect(left.map((p) => p.id)).toEqual(["p1"]);
  });

  it("matches stickers regardless of case/spacing, and only within the same project", () => {
    expect(stickerKey("p1", " cha-1157 ")).toBe(stickerKey("p1", "CHA-1157"));
    const left = remainingInstallOptions(projects, new Set([stickerKey("p2", "CHA-1157")]));
    expect(left[0].stickerNumbers).toEqual(["CHA-1157", "CHA-1158"]);
  });
});

import { installReadiness, installSetupFrom } from "../install-options";

describe("install setup (the warehouse's steps)", () => {
  const leadsun = (groups: { GatewayCode: string; GroupName: string }[]) => ({
    ProjectId: "LS-1",
    ProjectName: "Spine Road",
    totalGateways: groups.length,
    totalPoles: 0,
    groups: groups.map((g, i) => ({ GroupId: i + 1, totalPoles: 0, products: [], ...g })),
  });

  it("needs a Leadsun project first", () => {
    expect(installSetupFrom(null)).toEqual({ leadsunProject: false, gateways: [] });
    expect(installReadiness(installSetupFrom(null))).toBe("needsLeadsunProject");
  });

  it("then a gateway", () => {
    const setup = installSetupFrom(leadsun([]));
    expect(setup).toEqual({ leadsunProject: true, gateways: [] });
    expect(installReadiness(setup)).toBe("needsGateway");
  });

  it("is ready once there's a gateway, listing them by code and name", () => {
    const setup = installSetupFrom(leadsun([{ GatewayCode: " GW-0042 ", GroupName: "North" }, { GatewayCode: "", GroupName: "Blank" }]));
    expect(setup.gateways).toEqual([{ code: "GW-0042", name: "North", groupId: 1 }]); // with Leadsun's group id
    expect(installReadiness(setup)).toBe("ready");
  });

  it("treats a list without setup information (saved before the update) as ready, never blocking a crew offline", () => {
    expect(installReadiness(undefined)).toBe("ready");
  });
});

import { gatewayGroupName, isGatewayPoleRegistered } from "../install-options";

describe("gateway registration rules", () => {
  it("names a gateway's group after its gateway pole, then the project", () => {
    expect(gatewayGroupName(" TESTSL1-1001 ", " Streetleaf - SL1 Test ")).toBe("TESTSL1-1001 Streetleaf - SL1 Test");
  });

  it("knows a gateway pole is registered when a group is named after it", () => {
    const gateways = [{ name: "TESTSL1-1001 Streetleaf - SL1 Test" }, { name: "PAS-7" }];
    expect(isGatewayPoleRegistered("testsl1-1001", gateways)).toBe(true);
    expect(isGatewayPoleRegistered("PAS-7", gateways)).toBe(true);
    // Not fooled by a pole number that merely starts the same way.
    expect(isGatewayPoleRegistered("TESTSL1-100", gateways)).toBe(false);
    expect(isGatewayPoleRegistered("TESTSL1-1002", gateways)).toBe(false);
  });
});

import { connectedPolesFor, gatewayPlanForPole, parseGatewayPlans } from "../install-options";

describe("planned gateways (the project's `gateways` field)", () => {
  // As /getProjects sends it: a JSON string.
  const RAW =
    '[{"Name":"Test Gateway TESTSL1-1001","PoleNumber":"TESTSL1-1001","ControllerId":"12607D38CF","ConnectedPoles":["TESTSL1-1001","TESTSL1-1002","TESTSL1-1003"]},' +
    '{"Name":"Test Gateway TESTSL1-1004","PoleNumber":"TESTSL1-1004","ControllerId":"12607ED96C","ConnectedPoles":["TESTSL1-1004","TESTSL1-1005","TESTSL1-1006"]}]';
  const plans = parseGatewayPlans(RAW);

  it("reads the JSON string (or a list), skipping malformed entries", () => {
    expect(plans).toEqual([
      { name: "Test Gateway TESTSL1-1001", poleNumber: "TESTSL1-1001", controllerId: "12607D38CF", connectedPoles: ["TESTSL1-1001", "TESTSL1-1002", "TESTSL1-1003"] },
      { name: "Test Gateway TESTSL1-1004", poleNumber: "TESTSL1-1004", controllerId: "12607ED96C", connectedPoles: ["TESTSL1-1004", "TESTSL1-1005", "TESTSL1-1006"] },
    ]);
    expect(parseGatewayPlans(JSON.parse(RAW))).toEqual(plans);
    expect(parseGatewayPlans([{ Name: "", PoleNumber: "X" }, null, { Name: "N", PoleNumber: "P" }])).toEqual([
      { name: "N", poleNumber: "P", controllerId: null, connectedPoles: [] },
    ]);
    expect(parseGatewayPlans("not json")).toEqual([]);
    expect(parseGatewayPlans(undefined)).toEqual([]);
  });

  it("finds a gateway pole's planned name (used when registering it)", () => {
    expect(gatewayPlanForPole("testsl1-1004", plans)?.name).toBe("Test Gateway TESTSL1-1004");
    expect(gatewayPlanForPole("TESTSL1-1002", plans)).toBeNull();
  });

  it("gives a registered gateway's poles: matched by name, or by its gateway pole", () => {
    expect(connectedPolesFor({ name: "Test Gateway TESTSL1-1004" }, plans)).toEqual(["TESTSL1-1004", "TESTSL1-1005", "TESTSL1-1006"]);
    // Registered earlier under the older "<pole> <project>" name.
    expect(connectedPolesFor({ name: "TESTSL1-1001 Streetleaf - SL1 Test" }, plans)).toEqual(["TESTSL1-1001", "TESTSL1-1002", "TESTSL1-1003"]);
    expect(connectedPolesFor({ name: "Some other gateway" }, plans)).toBeNull();
  });

  it("knows a gateway pole is registered under the planned name too", () => {
    expect(isGatewayPoleRegistered("TESTSL1-1001", [{ name: "Test Gateway TESTSL1-1001" }])).toBe(true);
    expect(isGatewayPoleRegistered("TESTSL1-100", [{ name: "Test Gateway TESTSL1-1001" }])).toBe(false);
  });
});
