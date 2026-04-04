import { describe, expect, it } from "vitest";
import {
  buildHashString,
  parseCartString,
  parseHashParams,
  parseShareParams,
  serializeCart,
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
  });
});
