import { describe, expect, it } from "vitest";
import { crewScopeFrom, hasStickerNumbers, isCrew } from "../crew-access";

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

  it("gives crews the sticker projects and their customers only", () => {
    const scope = crewScopeFrom([
      { id: "p1", customerId: "c1", stickerNumbers: ["CHA-1157", "CHA-1158"] },
      { id: "p2", customerId: "c1", stickerNumbers: [] },
      { id: "p3", customerId: "c2", stickerNumbers: [] },
      { id: "p4", customerId: "c3", stickerNumbers: ["BAB-1"] },
    ]);
    expect([...scope.projectIds]).toEqual(["p1", "p4"]);
    expect([...scope.customerIds]).toEqual(["c1", "c3"]);
  });
});
