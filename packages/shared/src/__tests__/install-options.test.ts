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
