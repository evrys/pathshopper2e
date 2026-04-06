import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { getUpgradeOptions, getVariantBaseId } from "./variants";

/** Minimal item factory for tests. */
function makeItem(
  overrides: Partial<Item> & Pick<Item, "id" | "name" | "price">,
): Item {
  return {
    type: "equipment",
    level: 0,
    category: "",
    traits: [],
    rarity: "common",
    bulk: 0,
    usage: "",
    source: "",
    sourceId: "",
    sourceCategory: "",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

describe("getVariantBaseId", () => {
  it("returns the base ID for a dotted ID", () => {
    expect(getVariantBaseId("e2829.2659")).toBe("e2829");
  });

  it("returns null for an ID without a dot", () => {
    expect(getVariantBaseId("e345")).toBeNull();
  });

  it("returns null for custom items", () => {
    expect(getVariantBaseId("custom-0")).toBeNull();
  });
});

describe("getUpgradeOptions", () => {
  const striking = makeItem({
    id: "e2829.2659",
    name: "Striking",
    level: 4,
    price: { gp: 65 },
  });
  const greaterStriking = makeItem({
    id: "e2829.2660",
    name: "Striking (Greater)",
    level: 12,
    price: { gp: 1065 },
  });
  const majorStriking = makeItem({
    id: "e2829.2661",
    name: "Striking (Major)",
    level: 19,
    price: { gp: 31065 },
  });
  const unrelated = makeItem({
    id: "e100",
    name: "Longsword",
    level: 0,
    price: { gp: 1 },
  });

  const allItems = [striking, greaterStriking, majorStriking, unrelated];

  it("returns cheaper variants sorted by price descending", () => {
    const opts = getUpgradeOptions(majorStriking, allItems);
    expect(opts).toHaveLength(2);
    expect(opts[0].name).toBe("Striking (Greater)");
    expect(opts[0].priceCp).toBe(106500);
    expect(opts[1].name).toBe("Striking");
    expect(opts[1].priceCp).toBe(6500);
  });

  it("returns empty for the cheapest variant", () => {
    expect(getUpgradeOptions(striking, allItems)).toEqual([]);
  });

  it("returns empty for items without a dot ID", () => {
    expect(getUpgradeOptions(unrelated, allItems)).toEqual([]);
  });

  it("does not include items with the same or higher price", () => {
    const opts = getUpgradeOptions(greaterStriking, allItems);
    expect(opts).toHaveLength(1);
    expect(opts[0].name).toBe("Striking");
  });

  it("formats price display correctly", () => {
    const opts = getUpgradeOptions(greaterStriking, allItems);
    expect(opts[0].priceDisplay).toBe("65 gp");
  });

  it("formats sub-gp prices with sp/cp", () => {
    const cheap = makeItem({
      id: "e50.1",
      name: "Widget",
      price: { sp: 5 },
    });
    const expensive = makeItem({
      id: "e50.2",
      name: "Widget (Greater)",
      price: { gp: 10 },
    });
    const opts = getUpgradeOptions(expensive, [cheap, expensive]);
    expect(opts[0].priceDisplay).toBe("5 sp");
  });
});
