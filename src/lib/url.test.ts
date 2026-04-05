import { describe, expect, it } from "vitest";
import type { Discount, Item } from "../types";
import {
  buildCustomIdMap,
  buildHashString,
  parseCartString,
  parseCustomItems,
  parseHashParams,
  parseNotes,
  parseShareParams,
  serializeCart,
  serializeCustomItems,
  serializeNotes,
} from "./url";

/** Helper: extract just the cart map from parseCartString. */
function cartOf(s: string) {
  return parseCartString(s).cart;
}

/** Helper: extract just the discounts map from parseCartString. */
function discountsOf(s: string) {
  return parseCartString(s).discounts;
}

describe("parseCartString", () => {
  it("returns empty maps for empty string", () => {
    expect(cartOf("")).toEqual(new Map());
    expect(discountsOf("")).toEqual(new Map());
  });

  it("parses a single item with default qty 1", () => {
    expect(cartOf("sword-01")).toEqual(new Map([["sword-01", 1]]));
  });

  it("parses a single item with explicit qty", () => {
    expect(cartOf("arrow-01*20")).toEqual(new Map([["arrow-01", 20]]));
  });

  it("parses multiple items separated by +", () => {
    const { cart } = parseCartString("sword-01+shield-02*2+potion-03");
    expect(cart).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("skips entries with qty <= 0", () => {
    expect(cartOf("sword-01*0")).toEqual(new Map());
    expect(cartOf("sword-01*-1")).toEqual(new Map());
  });

  it("treats non-numeric suffix after * as id with qty 1", () => {
    expect(cartOf("some*thing")).toEqual(new Map([["some*thing", 1]]));
  });

  it("accepts legacy : separator for backwards compatibility", () => {
    expect(cartOf("arrow-01:20")).toEqual(new Map([["arrow-01", 20]]));
    expect(cartOf("sword-01+shield-02:2+potion-03")).toEqual(
      new Map([
        ["sword-01", 1],
        ["shield-02", 2],
        ["potion-03", 1],
      ]),
    );
  });

  it("handles qty 1 explicitly", () => {
    expect(cartOf("item-01*1")).toEqual(new Map([["item-01", 1]]));
  });

  it("parses inline flat discount with ~d suffix", () => {
    const { cart, discounts } = parseCartString("sword-01~d500");
    expect(cart).toEqual(new Map([["sword-01", 1]]));
    expect(discounts).toEqual(
      new Map([["sword-01", { type: "flat", cp: 500 }]]),
    );
  });

  it("parses qty and flat discount together", () => {
    const { cart, discounts } = parseCartString("arrow-01*5~d100");
    expect(cart).toEqual(new Map([["arrow-01", 5]]));
    expect(discounts).toEqual(
      new Map([["arrow-01", { type: "flat", cp: 100 }]]),
    );
  });

  it("parses percentage discount with ~p suffix", () => {
    const { cart, discounts } = parseCartString("sword-01~p25");
    expect(cart).toEqual(new Map([["sword-01", 1]]));
    expect(discounts).toEqual(
      new Map([["sword-01", { type: "percent", percent: 25 }]]),
    );
  });

  it("parses qty and percentage discount together", () => {
    const { cart, discounts } = parseCartString("arrow-01*3~p10");
    expect(cart).toEqual(new Map([["arrow-01", 3]]));
    expect(discounts).toEqual(
      new Map([["arrow-01", { type: "percent", percent: 10 }]]),
    );
  });

  it("parses upgrade discount with ~u suffix", () => {
    const { cart, discounts } = parseCartString("rune-01~u6500");
    expect(cart).toEqual(new Map([["rune-01", 1]]));
    expect(discounts).toEqual(
      new Map([["rune-01", { type: "upgrade", cp: 6500 }]]),
    );
  });

  it("parses qty and upgrade discount together", () => {
    const { cart, discounts } = parseCartString("rune-01*2~u6500");
    expect(cart).toEqual(new Map([["rune-01", 2]]));
    expect(discounts).toEqual(
      new Map([["rune-01", { type: "upgrade", cp: 6500 }]]),
    );
  });

  it("parses crafting discount with ~c suffix", () => {
    const { cart, discounts } = parseCartString("sword-01~c");
    expect(cart).toEqual(new Map([["sword-01", 1]]));
    expect(discounts).toEqual(new Map([["sword-01", { type: "crafting" }]]));
  });

  it("parses qty and crafting discount together", () => {
    const { cart, discounts } = parseCartString("sword-01*3~c");
    expect(cart).toEqual(new Map([["sword-01", 3]]));
    expect(discounts).toEqual(new Map([["sword-01", { type: "crafting" }]]));
  });

  it("parses mixed entries with and without discounts", () => {
    const { cart, discounts } = parseCartString(
      "sword-01*2~d500+shield-02+potion-03~p50",
    );
    expect(cart).toEqual(
      new Map([
        ["sword-01", 2],
        ["shield-02", 1],
        ["potion-03", 1],
      ]),
    );
    expect(discounts).toEqual(
      new Map<string, unknown>([
        ["sword-01", { type: "flat", cp: 500 }],
        ["potion-03", { type: "percent", percent: 50 }],
      ]),
    );
  });

  it("ignores discount of 0 or negative", () => {
    expect(discountsOf("sword-01~d0")).toEqual(new Map());
    expect(discountsOf("sword-01~d-5")).toEqual(new Map());
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

  it("appends ~d suffix for flat discounts", () => {
    const cart = new Map([["sword-01", 1]]);
    const discounts = new Map([
      ["sword-01", { type: "flat" as const, cp: 500 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01~d500");
  });

  it("appends ~p suffix for percentage discounts", () => {
    const cart = new Map([["sword-01", 1]]);
    const discounts = new Map([
      ["sword-01", { type: "percent" as const, percent: 25 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01~p25");
  });

  it("appends discount after qty", () => {
    const cart = new Map([["arrow-01", 5]]);
    const discounts = new Map([
      ["arrow-01", { type: "flat" as const, cp: 100 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("arrow-01*5~d100");
  });

  it("mixes discounted and non-discounted items", () => {
    const cart = new Map([
      ["sword-01", 2],
      ["shield-02", 1],
    ]);
    const discounts = new Map([
      ["sword-01", { type: "percent" as const, percent: 10 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01*2~p10+shield-02");
  });

  it("ignores discount map for items not in cart", () => {
    const cart = new Map([["sword-01", 1]]);
    const discounts = new Map([
      ["other-99", { type: "flat" as const, cp: 500 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01");
  });

  it("appends ~u suffix for upgrade discounts", () => {
    const cart = new Map([["rune-01", 1]]);
    const discounts = new Map([
      ["rune-01", { type: "upgrade" as const, cp: 6500 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("rune-01~u6500");
  });

  it("appends upgrade discount after qty", () => {
    const cart = new Map([["rune-01", 2]]);
    const discounts = new Map([
      ["rune-01", { type: "upgrade" as const, cp: 6500 }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("rune-01*2~u6500");
  });

  it("appends ~c suffix for crafting discounts", () => {
    const cart = new Map([["sword-01", 1]]);
    const discounts = new Map<string, Discount>([
      ["sword-01", { type: "crafting" }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01~c");
  });

  it("appends crafting discount after qty", () => {
    const cart = new Map([["sword-01", 3]]);
    const discounts = new Map<string, Discount>([
      ["sword-01", { type: "crafting" }],
    ]);
    expect(serializeCart(cart, discounts)).toBe("sword-01*3~c");
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

describe("parseShareParams with discounts", () => {
  it("parses inline flat discount from the items param", () => {
    const params = new URLSearchParams();
    params.set("items", "sword-01~d500+shield-02*2");

    const result = parseShareParams(params);
    expect(result.cart.get("sword-01")).toBe(1);
    expect(result.cart.get("shield-02")).toBe(2);
    expect(result.discounts.get("sword-01")).toEqual({
      type: "flat",
      cp: 500,
    });
    expect(result.discounts.has("shield-02")).toBe(false);
  });

  it("parses inline percentage discount from the items param", () => {
    const params = new URLSearchParams();
    params.set("items", "sword-01~p25");

    const result = parseShareParams(params);
    expect(result.discounts.get("sword-01")).toEqual({
      type: "percent",
      percent: 25,
    });
  });

  it("returns empty discount map when no discounts in items", () => {
    const params = new URLSearchParams();
    params.set("items", "sword-01+shield-02*2");

    const result = parseShareParams(params);
    expect(result.discounts.size).toBe(0);
  });

  it("roundtrips cart with flat discount through serialize/parse", () => {
    const cart = new Map([
      ["sword-01", 2],
      ["potion-03", 1],
    ]);
    const discounts = new Map([
      ["sword-01", { type: "flat" as const, cp: 1000 }],
    ]);
    const serialized = serializeCart(cart, discounts);
    const parsed = parseCartString(serialized);
    expect(parsed.cart).toEqual(cart);
    expect(parsed.discounts).toEqual(discounts);
  });

  it("roundtrips cart with percentage discount through serialize/parse", () => {
    const cart = new Map([["sword-01", 1]]);
    const discounts = new Map([
      ["sword-01", { type: "percent" as const, percent: 15 }],
    ]);
    const serialized = serializeCart(cart, discounts);
    const parsed = parseCartString(serialized);
    expect(parsed.cart).toEqual(cart);
    expect(parsed.discounts).toEqual(discounts);
  });
});

describe("serializeNotes / parseNotes", () => {
  it("returns empty string for empty map", () => {
    expect(serializeNotes(new Map())).toBe("");
  });

  it("returns empty map for empty string", () => {
    expect(parseNotes("")).toEqual(new Map());
  });

  it("roundtrips a single note", () => {
    const notes = new Map([["w1", "Buy from the smith"]]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(notes);
  });

  it("roundtrips multiple notes", () => {
    const notes = new Map([
      ["w1", "Buy from the smith"],
      ["a2", "Available at the market"],
    ]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(notes);
  });

  it("handles colons in note text", () => {
    const notes = new Map([["w1", "Note: important"]]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(notes);
  });

  it("handles pipes in note text", () => {
    const notes = new Map([["w1", "option A | option B"]]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(notes);
  });

  it("handles backslashes in note text", () => {
    const notes = new Map([["w1", "path\\to\\file"]]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(notes);
  });

  it("skips empty notes", () => {
    const notes = new Map([
      ["w1", "hello"],
      ["w2", ""],
    ]);
    const serialized = serializeNotes(notes);
    expect(parseNotes(serialized)).toEqual(new Map([["w1", "hello"]]));
  });

  it("applies id mapping when serializing", () => {
    const notes = new Map([["custom-abc-123", "My custom note"]]);
    const idMap = new Map([["custom-abc-123", "custom-0"]]);
    const serialized = serializeNotes(notes, idMap);
    expect(parseNotes(serialized)).toEqual(
      new Map([["custom-0", "My custom note"]]),
    );
  });
});
