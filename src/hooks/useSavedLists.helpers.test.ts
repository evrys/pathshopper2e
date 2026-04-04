import { describe, expect, it } from "vitest";
import type { Discount, Item } from "../types";
import type { CartEntry } from "./useCart";
import {
  cartEntriesToSavedData,
  expandCustomItems,
  savedListToCartEntries,
  shareDataToSavedData,
  type SavedCustomItem,
  type SavedList,
} from "./useSavedLists";

/** Minimal item stub for testing. */
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "w1",
    name: "Longsword",
    type: "weapon",
    level: 1,
    price: { gp: 1 },
    category: "Base Weapons",
    traits: [],
    rarity: "common",
    bulk: 1,
    usage: "held in 1 hand",
    source: "Core Rulebook",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

describe("cartEntriesToSavedData", () => {
  it("converts a simple cart to saved data", () => {
    const entries = new Map<string, CartEntry>([
      ["w1", { item: makeItem(), quantity: 2 }],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.items).toEqual({ w1: 2 });
    expect(result.discounts).toBeUndefined();
    expect(result.customItems).toBeUndefined();
  });

  it("includes discounts when present", () => {
    const discount: Discount = { type: "flat", cp: 50 };
    const entries = new Map<string, CartEntry>([
      ["w1", { item: makeItem(), quantity: 1, discount }],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.discounts).toEqual({ w1: { type: "flat", cp: 50 } });
  });

  it("extracts custom items", () => {
    const customItem = makeItem({
      id: "custom-abc",
      name: "Magic Wand",
      price: { gp: 50 },
    });
    const entries = new Map<string, CartEntry>([
      ["custom-abc", { item: customItem, quantity: 1 }],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.customItems).toEqual([
      { id: "custom-abc", name: "Magic Wand", price: { gp: 50 } },
    ]);
  });

  it("handles mixed regular, discounted, and custom items", () => {
    const entries = new Map<string, CartEntry>([
      ["w1", { item: makeItem(), quantity: 3 }],
      [
        "a1",
        {
          item: makeItem({ id: "a1", name: "Chain Mail", price: { gp: 6 } }),
          quantity: 1,
          discount: { type: "percent", percent: 10 },
        },
      ],
      [
        "custom-0",
        {
          item: makeItem({
            id: "custom-0",
            name: "Potion",
            price: { sp: 5 },
          }),
          quantity: 2,
        },
      ],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.items).toEqual({ w1: 3, a1: 1, "custom-0": 2 });
    expect(result.discounts).toEqual({
      a1: { type: "percent", percent: 10 },
    });
    expect(result.customItems).toEqual([
      { id: "custom-0", name: "Potion", price: { sp: 5 } },
    ]);
  });

  it("returns empty items for empty cart", () => {
    const result = cartEntriesToSavedData(new Map());
    expect(result.items).toEqual({});
    expect(result.discounts).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.customItems).toBeUndefined();
  });

  it("includes notes when present", () => {
    const entries = new Map<string, CartEntry>([
      [
        "w1",
        {
          item: makeItem(),
          quantity: 1,
          notes: "Buy from the smith",
        },
      ],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.notes).toEqual({ w1: "Buy from the smith" });
  });

  it("omits notes when none are present", () => {
    const entries = new Map<string, CartEntry>([
      ["w1", { item: makeItem(), quantity: 1 }],
    ]);
    const result = cartEntriesToSavedData(entries);
    expect(result.notes).toBeUndefined();
  });
});

describe("shareDataToSavedData", () => {
  it("converts share URL data to saved list data", () => {
    const cart = new Map([["w1", 2]]);
    const discounts = new Map<string, Discount>([
      ["w1", { type: "flat", cp: 50 }],
    ]);
    const customItems: Item[] = [];
    const result = shareDataToSavedData(cart, discounts, customItems);
    expect(result.items).toEqual({ w1: 2 });
    expect(result.discounts).toEqual({ w1: { type: "flat", cp: 50 } });
    expect(result.customItems).toBeUndefined();
  });

  it("handles custom items from share URL", () => {
    const cart = new Map([["custom-0", 1]]);
    const discounts = new Map<string, Discount>();
    const customItems = [makeItem({ id: "custom-0", name: "Wand" })];
    const result = shareDataToSavedData(cart, discounts, customItems);
    expect(result.customItems).toEqual([
      { id: "custom-0", name: "Wand", price: { gp: 1 } },
    ]);
  });

  it("omits discounts when map is empty", () => {
    const result = shareDataToSavedData(new Map([["w1", 1]]), new Map(), []);
    expect(result.discounts).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.customItems).toBeUndefined();
  });

  it("includes notes when provided", () => {
    const cart = new Map([["w1", 1]]);
    const notes = new Map([["w1", "Important item"]]);
    const result = shareDataToSavedData(cart, new Map(), [], notes);
    expect(result.notes).toEqual({ w1: "Important item" });
  });
});

describe("expandCustomItems", () => {
  it("returns empty array for undefined input", () => {
    expect(expandCustomItems(undefined)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(expandCustomItems([])).toEqual([]);
  });

  it("expands saved custom items into full Item objects", () => {
    const saved: SavedCustomItem[] = [
      { id: "custom-0", name: "Magic Wand", price: { gp: 50 } },
    ];
    const result = expandCustomItems(saved);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("custom-0");
    expect(result[0].name).toBe("Magic Wand");
    expect(result[0].price).toEqual({ gp: 50 });
    expect(result[0].type).toBe("equipment");
    expect(result[0].category).toBe("Custom");
    expect(result[0].level).toBe(0);
  });
});

describe("savedListToCartEntries", () => {
  const itemDb = [
    makeItem(),
    makeItem({ id: "a1", name: "Chain Mail", price: { gp: 6 } }),
  ];

  it("builds cart entries from a saved list", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { w1: 2, a1: 1 },
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result).toBeDefined();
    expect(result?.size).toBe(2);
    expect(result?.get("w1")?.quantity).toBe(2);
    expect(result?.get("a1")?.quantity).toBe(1);
  });

  it("applies discounts from saved list", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { w1: 1 },
      discounts: { w1: { type: "flat", cp: 50 } },
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result?.get("w1")?.discount).toEqual({ type: "flat", cp: 50 });
  });

  it("includes custom items from saved list", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { "custom-0": 1 },
      customItems: [{ id: "custom-0", name: "Magic Wand", price: { gp: 50 } }],
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result).toBeDefined();
    expect(result?.get("custom-0")?.item.name).toBe("Magic Wand");
    expect(result?.get("custom-0")?.quantity).toBe(1);
  });

  it("returns undefined for empty items", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: {},
      savedAt: "",
    };
    expect(savedListToCartEntries(list, itemDb)).toBeUndefined();
  });

  it("skips items not found in the item database", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { "nonexistent-item": 1 },
      savedAt: "",
    };
    expect(savedListToCartEntries(list, itemDb)).toBeUndefined();
  });

  it("handles discount + custom item together", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { w1: 1, "custom-0": 2 },
      discounts: { "custom-0": { type: "percent", percent: 25 } },
      customItems: [{ id: "custom-0", name: "Potion", price: { sp: 10 } }],
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result).toBeDefined();
    expect(result?.size).toBe(2);
    expect(result?.get("w1")?.discount).toBeUndefined();
    expect(result?.get("custom-0")?.discount).toEqual({
      type: "percent",
      percent: 25,
    });
    expect(result?.get("custom-0")?.item.name).toBe("Potion");
  });

  it("includes notes from saved list", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { w1: 1 },
      notes: { w1: "For the boss fight" },
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result?.get("w1")?.notes).toBe("For the boss fight");
  });

  it("does not set notes when not present in saved list", () => {
    const list: SavedList = {
      id: "test",
      name: "Test",
      items: { w1: 1 },
      savedAt: "",
    };
    const result = savedListToCartEntries(list, itemDb);
    expect(result?.get("w1")?.notes).toBeUndefined();
  });
});
