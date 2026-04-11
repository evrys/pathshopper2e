import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import {
  cartReducer,
  sortEntries,
  type CartEntry,
  type CartState,
} from "./useCart";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "w386",
    name: "Longsword",
    type: "weapons",
    level: 0,
    price: { gp: 1 },
    category: "Base Weapons",
    traits: [],
    rarity: "common",
    bulk: 1,
    usage: "held in 1 hand",
    source: "Player Core",
    sourceId: "1",
    sourceCategory: "Rulebooks",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

const emptyState: CartState = { entries: new Map() };

describe("cartReducer", () => {
  describe("add", () => {
    it("adds a new item with quantity 1", () => {
      const item = makeItem();
      const state = cartReducer(emptyState, { type: "add", item });
      expect(state.entries.size).toBe(1);
      expect(state.entries.get("w386")?.quantity).toBe(1);
    });

    it("increments quantity for existing item", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, { type: "add", item });
      expect(state.entries.get("w386")?.quantity).toBe(2);
    });

    it("tracks different items separately", () => {
      const sword = makeItem();
      const potion = makeItem({ id: "potion-1", name: "Healing Potion" });
      let state = cartReducer(emptyState, { type: "add", item: sword });
      state = cartReducer(state, { type: "add", item: potion });
      expect(state.entries.size).toBe(2);
    });
  });

  describe("remove", () => {
    it("removes an item entirely", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, { type: "remove", itemId: "w386" });
      expect(state.entries.size).toBe(0);
    });

    it("does nothing for unknown item", () => {
      const state = cartReducer(emptyState, {
        type: "remove",
        itemId: "nonexistent",
      });
      expect(state.entries.size).toBe(0);
    });
  });

  describe("set-quantity", () => {
    it("sets the quantity", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "w386",
        quantity: 5,
      });
      expect(state.entries.get("w386")?.quantity).toBe(5);
    });

    it("removes item when quantity is 0", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "w386",
        quantity: 0,
      });
      expect(state.entries.size).toBe(0);
    });

    it("removes item when quantity is negative", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "w386",
        quantity: -1,
      });
      expect(state.entries.size).toBe(0);
    });
  });

  describe("clear", () => {
    it("removes all items", () => {
      const sword = makeItem();
      const potion = makeItem({ id: "potion-1", name: "Healing Potion" });
      let state = cartReducer(emptyState, { type: "add", item: sword });
      state = cartReducer(state, { type: "add", item: potion });
      state = cartReducer(state, { type: "clear" });
      expect(state.entries.size).toBe(0);
    });
  });

  describe("custom items", () => {
    it("adds a custom item with custom- prefix id", () => {
      const custom = makeItem({
        id: "custom-1-1234567890",
        name: "Magic Sword",
        price: { gp: 50 },
        category: "Custom",
        source: "Custom",
      });
      const state = cartReducer(emptyState, { type: "add", item: custom });
      expect(state.entries.size).toBe(1);
      expect(state.entries.get("custom-1-1234567890")?.item.name).toBe(
        "Magic Sword",
      );
      expect(state.entries.get("custom-1-1234567890")?.quantity).toBe(1);
    });

    it("tracks custom items separately from regular items", () => {
      const regular = makeItem();
      const custom = makeItem({
        id: "custom-1-1234567890",
        name: "Custom Potion",
        price: { gp: 10 },
      });
      let state = cartReducer(emptyState, { type: "add", item: regular });
      state = cartReducer(state, { type: "add", item: custom });
      expect(state.entries.size).toBe(2);
    });

    it("increments quantity for the same custom item", () => {
      const custom = makeItem({
        id: "custom-1-1234567890",
        name: "Magic Sword",
      });
      let state = cartReducer(emptyState, { type: "add", item: custom });
      state = cartReducer(state, { type: "add", item: custom });
      expect(state.entries.get("custom-1-1234567890")?.quantity).toBe(2);
    });
  });

  describe("set-discount", () => {
    it("sets a flat discount on an item", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: { type: "flat", cp: 500 },
      });
      expect(state.entries.get("w386")?.priceModifier).toEqual({
        type: "flat",
        cp: 500,
      });
    });

    it("sets a percentage discount on an item", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: { type: "percent", percent: 25 },
      });
      expect(state.entries.get("w386")?.priceModifier).toEqual({
        type: "percent",
        percent: 25,
      });
    });

    it("clears discount when set to undefined", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: { type: "flat", cp: 250 },
      });
      expect(state.entries.get("w386")?.priceModifier).toBeDefined();
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: undefined,
      });
      expect(state.entries.get("w386")?.priceModifier).toBeUndefined();
    });

    it("does nothing for unknown item", () => {
      const state = cartReducer(emptyState, {
        type: "set-price-modifier",
        itemId: "nonexistent",
        priceModifier: { type: "flat", cp: 100 },
      });
      expect(state.entries.size).toBe(0);
    });

    it("preserves quantity when setting discount", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "w386",
        quantity: 5,
      });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: { type: "flat", cp: 200 },
      });
      expect(state.entries.get("w386")?.quantity).toBe(5);
      expect(state.entries.get("w386")?.priceModifier).toEqual({
        type: "flat",
        cp: 200,
      });
    });
  });

  describe("set-notes", () => {
    it("sets notes on an item", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "w386",
        notes: "Buy from Trader Joe",
      });
      expect(state.entries.get("w386")?.notes).toBe("Buy from Trader Joe");
    });

    it("clears notes when set to empty string", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "w386",
        notes: "some note",
      });
      expect(state.entries.get("w386")?.notes).toBe("some note");
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "w386",
        notes: "",
      });
      expect(state.entries.get("w386")?.notes).toBeUndefined();
    });

    it("does nothing for unknown item", () => {
      const state = cartReducer(emptyState, {
        type: "set-notes",
        itemId: "nonexistent",
        notes: "hello",
      });
      expect(state.entries.size).toBe(0);
    });

    it("preserves quantity and discount when setting notes", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "w386",
        quantity: 3,
      });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "w386",
        priceModifier: { type: "flat", cp: 100 },
      });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "w386",
        notes: "For the boss fight",
      });
      expect(state.entries.get("w386")?.quantity).toBe(3);
      expect(state.entries.get("w386")?.priceModifier).toEqual({
        type: "flat",
        cp: 100,
      });
      expect(state.entries.get("w386")?.notes).toBe("For the boss fight");
    });
  });

  describe("update-item", () => {
    it("updates item name", () => {
      const item = makeItem({ id: "custom-1", name: "Old Name" });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "update-item",
        itemId: "custom-1",
        update: { name: "New Name" },
      });
      expect(state.entries.get("custom-1")?.item.name).toBe("New Name");
    });

    it("updates item price", () => {
      const item = makeItem({ id: "custom-1", price: { gp: 5 } });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "update-item",
        itemId: "custom-1",
        update: { price: { sp: 10 } },
      });
      expect(state.entries.get("custom-1")?.item.price).toEqual({ sp: 10 });
    });

    it("updates both name and price", () => {
      const item = makeItem({
        id: "custom-1",
        name: "Old",
        price: { gp: 1 },
      });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "update-item",
        itemId: "custom-1",
        update: { name: "New", price: { cp: 50 } },
      });
      expect(state.entries.get("custom-1")?.item.name).toBe("New");
      expect(state.entries.get("custom-1")?.item.price).toEqual({ cp: 50 });
    });

    it("preserves other item fields", () => {
      const item = makeItem({
        id: "custom-1",
        name: "Wand",
        category: "Custom",
      });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "update-item",
        itemId: "custom-1",
        update: { name: "Better Wand" },
      });
      expect(state.entries.get("custom-1")?.item.category).toBe("Custom");
      expect(state.entries.get("custom-1")?.item.type).toBe("weapons");
    });

    it("preserves quantity, discount, and notes", () => {
      const item = makeItem({ id: "custom-1" });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "custom-1",
        quantity: 3,
      });
      state = cartReducer(state, {
        type: "set-price-modifier",
        itemId: "custom-1",
        priceModifier: { type: "flat", cp: 50 },
      });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "custom-1",
        notes: "A note",
      });
      state = cartReducer(state, {
        type: "update-item",
        itemId: "custom-1",
        update: { name: "Renamed" },
      });
      expect(state.entries.get("custom-1")?.quantity).toBe(3);
      expect(state.entries.get("custom-1")?.priceModifier).toEqual({
        type: "flat",
        cp: 50,
      });
      expect(state.entries.get("custom-1")?.notes).toBe("A note");
    });

    it("does nothing for unknown item", () => {
      const state = cartReducer(emptyState, {
        type: "update-item",
        itemId: "nonexistent",
        update: { name: "Nope" },
      });
      expect(state.entries.size).toBe(0);
    });
  });

  describe("reorder", () => {
    it("reorders entries by the given id list", () => {
      const a = makeItem({ id: "a", name: "Alpha" });
      const b = makeItem({ id: "b", name: "Beta" });
      const c = makeItem({ id: "c", name: "Gamma" });
      let state = cartReducer(emptyState, { type: "add", item: a });
      state = cartReducer(state, { type: "add", item: b });
      state = cartReducer(state, { type: "add", item: c });

      state = cartReducer(state, {
        type: "reorder",
        orderedIds: ["c", "a", "b"],
      });

      const ids = [...state.entries.keys()];
      expect(ids).toEqual(["c", "a", "b"]);
    });

    it("preserves entry data when reordering", () => {
      const item = makeItem({ id: "x" });
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-quantity",
        itemId: "x",
        quantity: 5,
      });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "x",
        notes: "keep me",
      });

      state = cartReducer(state, {
        type: "reorder",
        orderedIds: ["x"],
      });

      expect(state.entries.get("x")?.quantity).toBe(5);
      expect(state.entries.get("x")?.notes).toBe("keep me");
    });

    it("ignores unknown ids in the ordered list", () => {
      const item = makeItem({ id: "a" });
      let state = cartReducer(emptyState, { type: "add", item });

      state = cartReducer(state, {
        type: "reorder",
        orderedIds: ["nonexistent", "a"],
      });

      const ids = [...state.entries.keys()];
      expect(ids).toEqual(["a"]);
    });
  });
});

describe("sortEntries", () => {
  function entry(overrides: Partial<Item> = {}, qty = 1): CartEntry {
    return { item: makeItem(overrides), quantity: qty };
  }

  it("returns entries in original order for 'manual'", () => {
    const entries = [
      entry({ id: "a", name: "Zword", level: 5, price: { gp: 50 } }),
      entry({ id: "b", name: "Amulet", level: 1, price: { gp: 10 } }),
      entry({ id: "c", name: "Mace", level: 3, price: { gp: 30 } }),
    ];
    const sorted = sortEntries(entries, "manual");
    expect(sorted.map((e) => e.item.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by level ascending", () => {
    const entries = [
      entry({ id: "a", level: 5 }),
      entry({ id: "b", level: 1 }),
      entry({ id: "c", level: 3 }),
    ];
    const sorted = sortEntries(entries, "level-asc");
    expect(sorted.map((e) => e.item.level)).toEqual([1, 3, 5]);
  });

  it("sorts by level descending", () => {
    const entries = [
      entry({ id: "a", level: 1 }),
      entry({ id: "b", level: 5 }),
      entry({ id: "c", level: 3 }),
    ];
    const sorted = sortEntries(entries, "level-desc");
    expect(sorted.map((e) => e.item.level)).toEqual([5, 3, 1]);
  });

  it("sorts by level then by name for ties", () => {
    const entries = [
      entry({ id: "a", name: "Zword", level: 3 }),
      entry({ id: "b", name: "Amulet", level: 3 }),
      entry({ id: "c", name: "Mace", level: 1 }),
    ];
    const sorted = sortEntries(entries, "level-asc");
    expect(sorted.map((e) => e.item.name)).toEqual(["Mace", "Amulet", "Zword"]);
  });

  it("sorts by price ascending (copper value)", () => {
    const entries = [
      entry({ id: "a", price: { gp: 10 } }),
      entry({ id: "b", price: { sp: 5 } }),
      entry({ id: "c", price: { gp: 1 } }),
    ];
    const sorted = sortEntries(entries, "price-asc");
    expect(sorted.map((e) => e.item.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by price descending", () => {
    const entries = [
      entry({ id: "a", price: { gp: 10 } }),
      entry({ id: "b", price: { sp: 5 } }),
      entry({ id: "c", price: { gp: 1 } }),
    ];
    const sorted = sortEntries(entries, "price-desc");
    expect(sorted.map((e) => e.item.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by price then by name for ties", () => {
    const entries = [
      entry({ id: "a", name: "Zword", price: { gp: 5 } }),
      entry({ id: "b", name: "Amulet", price: { gp: 5 } }),
    ];
    const sorted = sortEntries(entries, "price-asc");
    expect(sorted.map((e) => e.item.name)).toEqual(["Amulet", "Zword"]);
  });

  it("does not mutate the original array", () => {
    const entries = [
      entry({ id: "a", level: 5 }),
      entry({ id: "b", level: 1 }),
    ];
    const sorted = sortEntries(entries, "level-asc");
    expect(sorted).not.toBe(entries);
    expect(entries[0].item.id).toBe("a");
  });
});
