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
});
