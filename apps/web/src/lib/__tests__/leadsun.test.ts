import { describe, expect, it } from "vitest";
import {
  findLeadsunGroupForProduct,
  findLeadsunProduct,
  hasLeadsunProducts,
  isLampOn,
} from "@/lib/leadsun";
import type { LeadsunProject } from "@/lib/types";

const leadsunProject: LeadsunProject = {
  ProjectId: "545",
  ProjectName: "Manatee County - Buffalo Creek",
  totalGateways: 1,
  totalPoles: 2,
  groups: [
    {
      GroupId: 1263,
      GroupName: "Buffalo Creek",
      GatewayCode: "GT12L94A2310260A",
      totalPoles: 2,
      products: [
        {
          ProductId: 12548,
          ProductName: "12081-1102",
          ProvidedProductId: "AEXSAP4323111877",
          PoleNumber: "AEXSAP4323111877-A",
        },
        {
          ProductId: 12549,
          ProductName: "12081-1103",
          ProvidedProductId: "AEXSAP4323111878",
          PoleNumber: "AEXSAP4323111878-A",
        },
      ],
    },
  ],
};

describe("hasLeadsunProducts", () => {
  it("is true when at least one group has at least one product", () => {
    expect(hasLeadsunProducts(leadsunProject)).toBe(true);
  });

  it("is false when every group has zero products", () => {
    expect(
      hasLeadsunProducts({ ...leadsunProject, groups: [{ ...leadsunProject.groups[0], products: [] }] }),
    ).toBe(false);
  });

  it("is false when there are no groups at all", () => {
    expect(hasLeadsunProducts({ ...leadsunProject, groups: [] })).toBe(false);
  });

  it("is false for null/undefined (no Leadsun project configured at all)", () => {
    expect(hasLeadsunProducts(null)).toBe(false);
    expect(hasLeadsunProducts(undefined)).toBe(false);
  });

  it("is true if any one of several groups has products, even if others don't", () => {
    expect(
      hasLeadsunProducts({
        ...leadsunProject,
        groups: [
          { ...leadsunProject.groups[0], products: [] },
          leadsunProject.groups[0],
        ],
      }),
    ).toBe(true);
  });
});

describe("findLeadsunProduct", () => {
  it("finds the product whose ProductName matches the given locationId", () => {
    const product = findLeadsunProduct(leadsunProject, "12081-1103");
    expect(product?.ProductId).toBe(12549);
    expect(product?.PoleNumber).toBe("AEXSAP4323111878-A");
  });

  it("returns undefined when no product matches", () => {
    expect(findLeadsunProduct(leadsunProject, "no-such-location")).toBeUndefined();
  });

  it("returns undefined for a null/undefined leadsunProject", () => {
    expect(findLeadsunProduct(null, "12081-1103")).toBeUndefined();
    expect(findLeadsunProduct(undefined, "12081-1103")).toBeUndefined();
  });

  it("returns undefined for a null/undefined/empty locationId", () => {
    expect(findLeadsunProduct(leadsunProject, null)).toBeUndefined();
    expect(findLeadsunProduct(leadsunProject, undefined)).toBeUndefined();
    expect(findLeadsunProduct(leadsunProject, "")).toBeUndefined();
  });

  it("searches across every group, not just the first", () => {
    const secondGroupProject: LeadsunProject = {
      ...leadsunProject,
      groups: [
        { GroupId: 1, GroupName: "Empty", GatewayCode: "GW1", totalPoles: 0, products: [] },
        leadsunProject.groups[0],
      ],
    };
    expect(findLeadsunProduct(secondGroupProject, "12081-1102")?.ProductId).toBe(12548);
  });

  it("does not crash if groups is missing entirely on an otherwise-truthy leadsunProject (regression: was throwing on .some/.find of undefined)", () => {
    // @ts-expect-error deliberately malformed to reproduce the crash this guards against
    const malformed: LeadsunProject = { ProjectId: "1", ProjectName: "X", UserName: "Y" };
    expect(() => hasLeadsunProducts(malformed)).not.toThrow();
    expect(hasLeadsunProducts(malformed)).toBe(false);
    expect(() => findLeadsunProduct(malformed, "12081-1102")).not.toThrow();
    expect(findLeadsunProduct(malformed, "12081-1102")).toBeUndefined();
  });

  it("does not crash if a group's products field is missing", () => {
    const malformedGroup = {
      GroupId: 1,
      GroupName: "X",
      GatewayCode: "GW1",
    } as LeadsunProject["groups"][number];
    const project: LeadsunProject = { ...leadsunProject, groups: [malformedGroup] };
    expect(() => hasLeadsunProducts(project)).not.toThrow();
    expect(hasLeadsunProducts(project)).toBe(false);
    expect(() => findLeadsunProduct(project, "12081-1102")).not.toThrow();
  });
});

describe("isLampOn", () => {
  it("is ON when only lampPower1 is drawing power", () => {
    expect(isLampOn({ lampPower1: 45, lampPower2: 0 })).toBe(true);
  });

  it("is ON when only lampPower2 is drawing power", () => {
    expect(isLampOn({ lampPower1: 0, lampPower2: 30 })).toBe(true);
  });

  it("is ON when both channels are drawing power", () => {
    expect(isLampOn({ lampPower1: 20, lampPower2: 25 })).toBe(true);
  });

  it("is OFF when both channels are exactly 0", () => {
    expect(isLampOn({ lampPower1: 0, lampPower2: 0 })).toBe(false);
  });

  it("treats a negative reading combined with a positive one per the literal sum, not clamped", () => {
    // Documenting the exact rule as specified — sum > 0, no special-casing
    // of negative sensor noise.
    expect(isLampOn({ lampPower1: -5, lampPower2: 10 })).toBe(true);
    expect(isLampOn({ lampPower1: -5, lampPower2: 5 })).toBe(false);
  });
});

describe("findLeadsunGroupForProduct", () => {
  const multiGroupProject: LeadsunProject = {
    ...leadsunProject,
    groups: [
      leadsunProject.groups[0],
      {
        GroupId: 9999,
        GroupName: "Second Gateway",
        GatewayCode: "GW-SECOND",
        totalPoles: 1,
        products: [
          {
            ProductId: 77,
            ProductName: "other-loc",
            ProvidedProductId: "PROV-77",
            PoleNumber: "PROV-77-A",
          },
        ],
      },
    ],
  };

  it("finds the group containing the given product, matched by ProductId", () => {
    const group = findLeadsunGroupForProduct(multiGroupProject, { ProductId: 12549 });
    expect(group?.GroupName).toBe("Buffalo Creek");
  });

  it("searches across every group, not just the first", () => {
    const group = findLeadsunGroupForProduct(multiGroupProject, { ProductId: 77 });
    expect(group?.GroupName).toBe("Second Gateway");
  });

  it("returns undefined when no group contains a matching product", () => {
    expect(findLeadsunGroupForProduct(multiGroupProject, { ProductId: 999999 })).toBeUndefined();
  });

  it("returns undefined for a null/undefined leadsunProject", () => {
    expect(findLeadsunGroupForProduct(null, { ProductId: 12549 })).toBeUndefined();
    expect(findLeadsunGroupForProduct(undefined, { ProductId: 12549 })).toBeUndefined();
  });

  it("returns undefined for a null/undefined product", () => {
    expect(findLeadsunGroupForProduct(multiGroupProject, null)).toBeUndefined();
    expect(findLeadsunGroupForProduct(multiGroupProject, undefined)).toBeUndefined();
  });

  it("does not crash if groups/products are missing entirely", () => {
    // @ts-expect-error deliberately malformed for this test (missing groups)
    const malformed: LeadsunProject = { ProjectId: "1", ProjectName: "X" };
    expect(() => findLeadsunGroupForProduct(malformed, { ProductId: 1 })).not.toThrow();
    expect(findLeadsunGroupForProduct(malformed, { ProductId: 1 })).toBeUndefined();
  });
});
