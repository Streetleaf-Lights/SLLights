import { describe, expect, it } from "vitest";
import { crewScopeFrom, hasStickerNumbers, isCrew, isCrewProject } from "../crew-access";

describe("crew access", () => {
  it("recognises the crew role exactly", () => {
    expect(isCrew("Streetleaf Crew")).toBe(true);
    expect(isCrew("Streetleaf Admin")).toBe(false);
    expect(isCrew(null)).toBe(false);
  });

  it("counts a project as crew work only when it has sticker numbers", () => {
    expect(hasStickerNumbers({ stickerNumbers: ["CHA-1157"] })).toBe(true);
    expect(hasStickerNumbers({ stickerNumbers: [] })).toBe(false);
    expect(hasStickerNumbers({ stickerNumbers: [" ", ""] })).toBe(false);
    expect(hasStickerNumbers({ stickerNumbers: null })).toBe(false);
  });

  it("only counts active projects", () => {
    expect(isCrewProject({ active: true, stickerNumbers: ["CHA-1"] })).toBe(true);
    expect(isCrewProject({ active: false, stickerNumbers: ["CHA-1"] })).toBe(false);
    expect(isCrewProject({ active: true, stickerNumbers: [] })).toBe(false);
  });

  it("gives crews the active sticker projects and their customers only", () => {
    const scope = crewScopeFrom([
      { id: "p1", customerId: "c1", active: true, stickerNumbers: ["CHA-1157", "CHA-1158"] },
      { id: "p2", customerId: "c1", active: true, stickerNumbers: [] },
      { id: "p3", customerId: "c2", active: true, stickerNumbers: [] },
      { id: "p4", customerId: "c3", active: true, stickerNumbers: ["BAB-1"] },
      { id: "p5", customerId: "c4", active: false, stickerNumbers: ["OLD-1"] },
    ]);
    expect([...scope.projectIds]).toEqual(["p1", "p4"]);
    expect([...scope.customerIds]).toEqual(["c1", "c3"]);
  });
});
