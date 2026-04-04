import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { cartReducer, type CartState } from "./useCart";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "w386",
    name: "Longsword",
    type: "weapon",
    level: 0,
    price: { gp: 1 },
    category: "Base Weapons",
    traits: [],
    rarity: "common",
    bulk: 1,
    usage: "held in 1 hand",
    source: "Player Core",
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
        type: "set-discount",
        itemId: "w386",
        discount: { type: "flat", cp: 500 },
      });
      expect(state.entries.get("w386")?.discount).toEqual({
        type: "flat",
        cp: 500,
      });
    });

    it("sets a percentage discount on an item", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-discount",
        itemId: "w386",
        discount: { type: "percent", percent: 25 },
      });
      expect(state.entries.get("w386")?.discount).toEqual({
        type: "percent",
        percent: 25,
      });
    });

    it("clears discount when set to undefined", () => {
      const item = makeItem();
      let state = cartReducer(emptyState, { type: "add", item });
      state = cartReducer(state, {
        type: "set-discount",
        itemId: "w386",
        discount: { type: "flat", cp: 250 },
      });
      expect(state.entries.get("w386")?.discount).toBeDefined();
      state = cartReducer(state, {
        type: "set-discount",
        itemId: "w386",
        discount: undefined,
      });
      expect(state.entries.get("w386")?.discount).toBeUndefined();
    });

    it("does nothing for unknown item", () => {
      const state = cartReducer(emptyState, {
        type: "set-discount",
        itemId: "nonexistent",
        discount: { type: "flat", cp: 100 },
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
        type: "set-discount",
        itemId: "w386",
        discount: { type: "flat", cp: 200 },
      });
      expect(state.entries.get("w386")?.quantity).toBe(5);
      expect(state.entries.get("w386")?.discount).toEqual({
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
        type: "set-discount",
        itemId: "w386",
        discount: { type: "flat", cp: 100 },
      });
      state = cartReducer(state, {
        type: "set-notes",
        itemId: "w386",
        notes: "For the boss fight",
      });
      expect(state.entries.get("w386")?.quantity).toBe(3);
      expect(state.entries.get("w386")?.discount).toEqual({
        type: "flat",
        cp: 100,
      });
      expect(state.entries.get("w386")?.notes).toBe("For the boss fight");
    });
  });
});
