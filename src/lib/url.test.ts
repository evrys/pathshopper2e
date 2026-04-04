import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import {
  buildCustomIdMap,
  buildHashString,
  parseCartString,
  parseCustomItems,
  parseHashParams,
  parseShareParams,
  serializeCart,
  serializeCustomItems,
} from "./url";

describe("parseCartString", () => {
  it("returns empty map for empty string", () => {
    expect(parseCartString("")).toEqual(new Map());
  });

  it("parses a single item with default qty 1", () => {
    expect(parseCartString("sword-01")).toEqual(new Map([["sword-01", 1]]));
  });

  it("parses a single item with explicit qty", () => {
    expect(parseCartString("arrow-01*20")).toEqual(new Map([["arrow-01", 20]]));
  });

  it("parses multiple items separated by +", () => {
    const result = parseCartString("sword-01+shield-02*2+potion-03");
    expect(result).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("skips entries with qty <= 0", () => {
    expect(parseCartString("sword-01*0")).toEqual(new Map());
    expect(parseCartString("sword-01*-1")).toEqual(new Map());
  });

  it("treats non-numeric suffix after * as id with qty 1", () => {
    expect(parseCartString("some*thing")).toEqual(new Map([["some*thing", 1]]));
  });

  it("accepts legacy : separator for backwards compatibility", () => {
    expect(parseCartString("arrow-01:20")).toEqual(new Map([["arrow-01", 20]]));
    expect(parseCartString("sword-01+shield-02:2+potion-03")).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("handles qty 1 explicitly", () => {
    expect(parseCartString("item-01*1")).toEqual(new Map([["item-01", 1]]));
  });
});

describe("parseHashParams", () => {
  it("strips leading # and preserves + as literal values", () => {
    const params = parseHashParams("#q=fire+ice&type=weapon");
    expect(params.get("q")).toBe("fire+ice");
    expect(params.get("type")).toBe("weapon");
  });

  it("works without leading #", () => {
    const params = parseHashParams("q=hello");
    expect(params.get("q")).toBe("hello");
  });

  it("returns empty params for empty string", () => {
    const params = parseHashParams("");
    expect([...params]).toEqual([]);
  });
});

describe("buildHashString", () => {
  it("builds a #-prefixed string with + kept readable", () => {
    const params = new URLSearchParams();
    params.set("items", "sword-01+potion-02*3");
    expect(buildHashString(params)).toBe("#items=sword-01+potion-02*3");
  });

  it("returns empty string for empty params", () => {
    expect(buildHashString(new URLSearchParams())).toBe("");
  });
});

describe("serializeCart", () => {
  it("serializes items with qty 1 as bare ids", () => {
    expect(serializeCart(new Map([["sword-01", 1]]))).toBe("sword-01");
  });

  it("serializes items with qty > 1 using *", () => {
    expect(serializeCart(new Map([["arrow-01", 20]]))).toBe("arrow-01*20");
  });

  it("joins multiple items with +", () => {
    const cart = new Map([
      ["sword-01", 1],
      ["arrow-01", 20],
    ]);
    expect(serializeCart(cart)).toBe("sword-01+arrow-01*20");
  });

  it("returns empty string for empty cart", () => {
    expect(serializeCart(new Map())).toBe("");
  });
});

describe("parseShareParams", () => {
  it("extracts lid, items, and name params", () => {
    const params = new URLSearchParams();
    params.set("lid", "abc-123");
    params.set("name", "My Char");
    params.set("items", "sword-01+potion-02*3");

    const result = parseShareParams(params);
    expect(result.listId).toBe("abc-123");
    expect(result.charName).toBe("My Char");
    expect(result.cart).toEqual(
      new Map([
        ["sword-01", 1],
        ["potion-02", 3],
      ]),
    );
  });

  it("falls back to legacy param names (char, cart)", () => {
    const params = new URLSearchParams();
    params.set("char", "Legacy Name");
    params.set("cart", "item-01");

    const result = parseShareParams(params);
    expect(result.charName).toBe("Legacy Name");
    expect(result.cart).toEqual(new Map([["item-01", 1]]));
  });

  it("returns empty defaults when no share params present", () => {
    const result = parseShareParams(new URLSearchParams());
    expect(result.listId).toBe("");
    expect(result.charName).toBe("");
    expect(result.cart).toEqual(new Map());
    expect(result.customItems).toEqual([]);
  });
});

function makeCustomItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "custom-0-999",
    name: "Magic Sword",
    type: "equipment",
    level: 0,
    price: { gp: 50 },
    category: "Custom",
    traits: [],
    rarity: "common",
    bulk: 0,
    usage: "",
    source: "Custom",
    remaster: false,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

describe("serializeCustomItems", () => {
  it("serializes a single custom item with price", () => {
    const result = serializeCustomItems([
      { item: makeCustomItem({ name: "Magic Sword", price: { gp: 50 } }) },
    ]);
    expect(result).toBe("Magic Sword~50gp");
  });

  it("serializes a custom item with sp price", () => {
    const result = serializeCustomItems([
      { item: makeCustomItem({ name: "Rope", price: { sp: 5 } }) },
    ]);
    expect(result).toBe("Rope~5sp");
  });

  it("serializes a free custom item (no tilde)", () => {
    const result = serializeCustomItems([
      { item: makeCustomItem({ name: "Free Thing", price: {} }) },
    ]);
    expect(result).toBe("Free Thing");
  });

  it("serializes multiple custom items separated by commas", () => {
    const result = serializeCustomItems([
      { item: makeCustomItem({ name: "Sword", price: { gp: 10 } }) },
      { item: makeCustomItem({ name: "Shield", price: { gp: 5 } }) },
    ]);
    expect(result).toBe("Sword~10gp,Shield~5gp");
  });
});

describe("parseCustomItems", () => {
  it("returns empty array for empty string", () => {
    expect(parseCustomItems("")).toEqual([]);
  });

  it("parses a single custom item with price", () => {
    const items = parseCustomItems("Magic Sword~50gp");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("custom-0");
    expect(items[0].name).toBe("Magic Sword");
    expect(items[0].price).toEqual({ gp: 50 });
  });

  it("parses a free custom item (no tilde)", () => {
    const items = parseCustomItems("Free Thing");
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Free Thing");
    expect(items[0].price).toEqual({});
  });

  it("parses multiple custom items", () => {
    const items = parseCustomItems("Sword~10gp,Shield~5sp");
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Sword");
    expect(items[0].price).toEqual({ gp: 10 });
    expect(items[0].id).toBe("custom-0");
    expect(items[1].name).toBe("Shield");
    expect(items[1].price).toEqual({ sp: 5 });
    expect(items[1].id).toBe("custom-1");
  });

  it("roundtrips with serializeCustomItems", () => {
    const original = [
      { item: makeCustomItem({ name: "Sword", price: { gp: 10 } }) },
      { item: makeCustomItem({ name: "Potion", price: { cp: 3 } }) },
    ];
    const serialized = serializeCustomItems(original);
    const parsed = parseCustomItems(serialized);
    expect(parsed[0].name).toBe("Sword");
    expect(parsed[0].price).toEqual({ gp: 10 });
    expect(parsed[1].name).toBe("Potion");
    expect(parsed[1].price).toEqual({ cp: 3 });
  });
});

describe("buildCustomIdMap", () => {
  it("maps custom item ids to stable sequential ids", () => {
    const entries = [
      { item: makeCustomItem({ id: "custom-7-abc" }), quantity: 1 },
      { item: makeCustomItem({ id: "e1082" }), quantity: 2 },
      { item: makeCustomItem({ id: "custom-3-xyz" }), quantity: 1 },
    ];
    const map = buildCustomIdMap(entries);
    expect(map.size).toBe(2);
    expect(map.get("custom-7-abc")).toBe("custom-0");
    expect(map.get("custom-3-xyz")).toBe("custom-1");
  });

  it("returns empty map when no custom items", () => {
    const entries = [{ item: makeCustomItem({ id: "e1082" }), quantity: 1 }];
    expect(buildCustomIdMap(entries).size).toBe(0);
  });
});

describe("parseShareParams with custom items", () => {
  it("parses custom items from the custom param", () => {
    const params = new URLSearchParams();
    params.set("items", "custom-0+e1082*2");
    params.set("custom", "Magic Sword~50gp");

    const result = parseShareParams(params);
    expect(result.customItems).toHaveLength(1);
    expect(result.customItems[0].name).toBe("Magic Sword");
    expect(result.customItems[0].price).toEqual({ gp: 50 });
    expect(result.cart.get("custom-0")).toBe(1);
    expect(result.cart.get("e1082")).toBe(2);
  });
});
