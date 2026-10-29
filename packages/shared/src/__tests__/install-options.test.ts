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
    expect(setup.gateways).toEqual([{ code: "GW-0042", name: "North" }]);
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
