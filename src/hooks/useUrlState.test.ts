import { describe, expect, it } from "vitest";
import {
  _deserialize as deserialize,
  _serialize as serialize,
} from "./useUrlState";

describe("URL state serialization", () => {
  const defaults = {
    search: "",
    types: new Set<string>(),
    rarities: new Set(["common", "uncommon"]),
    remaster: new Set(["remastered"]),
    minLevel: "",
    maxLevel: "",
    sort: ":asc",
    charName: "",
    cart: new Map<string, number>(),
  };

  describe("serialize", () => {
    it("returns empty string for default state", () => {
      expect(serialize(defaults)).toBe("");
    });

    it("serializes search query", () => {
      const hash = serialize({ ...defaults, search: "longsword" });
      expect(hash).toContain("q=longsword");
    });

    it("serializes type filter", () => {
      const hash = serialize({
        ...defaults,
        types: new Set(["weapon", "armor"]),
      });
      expect(hash).toContain("type=armor+weapon");
    });

    it("serializes non-default rarity filter", () => {
      const hash = serialize({
        ...defaults,
        rarities: new Set(["rare"]),
      });
      expect(hash).toContain("rarity=rare");
    });

    it("omits rarity when it matches defaults", () => {
      const hash = serialize(defaults);
      expect(hash).not.toContain("rarity");
    });

    it("serializes non-default remaster filter", () => {
      const hash = serialize({
        ...defaults,
        remaster: new Set(["legacy"]),
      });
      expect(hash).toContain("remaster=legacy");
    });

    it("omits remaster when it matches defaults", () => {
      expect(serialize(defaults)).not.toContain("remaster");
    });

    it("serializes level range", () => {
      const hash = serialize({ ...defaults, minLevel: "3", maxLevel: "10" });
      expect(hash).toContain("minlvl=3");
      expect(hash).toContain("maxlvl=10");
    });

    it("serializes non-default sort", () => {
      const hash = serialize({ ...defaults, sort: "price:desc" });
      expect(hash).toContain("sort=price%3Adesc");
    });

    it("omits default sort", () => {
      expect(serialize(defaults)).not.toContain("sort");
    });

    it("serializes cart with quantities", () => {
      const cart = new Map([
        ["sword-1", 2],
        ["potion-1", 1],
      ]);
      const hash = serialize({ ...defaults, cart });
      expect(hash).toContain("cart=");
      // qty 1 omits the :1 suffix
      expect(hash).toContain("potion-1");
      expect(hash).not.toContain("potion-1%3A1");
      // qty 2 includes the :2 suffix
      expect(hash).toContain("sword-1%3A2");
    });

    it("omits cart when empty", () => {
      expect(serialize(defaults)).not.toContain("cart");
    });

    it("serializes character name", () => {
      const hash = serialize({ ...defaults, charName: "Valeros" });
      expect(hash).toContain("char=Valeros");
    });

    it("omits char when empty", () => {
      expect(serialize(defaults)).not.toContain("char");
    });
  });

  describe("deserialize", () => {
    it("returns defaults for empty hash", () => {
      const state = deserialize("");
      expect(state.search).toBe("");
      expect(state.types.size).toBe(0);
      expect(state.rarities).toEqual(new Set(["common", "uncommon"]));
      expect(state.remaster).toEqual(new Set(["remastered"]));
      expect(state.minLevel).toBe("");
      expect(state.maxLevel).toBe("");
      expect(state.sort).toBe(":asc");
      expect(state.charName).toBe("");
      expect(state.cart.size).toBe(0);
    });

    it("parses search query", () => {
      const state = deserialize("#q=longsword");
      expect(state.search).toBe("longsword");
    });

    it("parses type filter", () => {
      const state = deserialize("#type=weapon+armor");
      expect(state.types).toEqual(new Set(["weapon", "armor"]));
    });

    it("parses rarity filter", () => {
      const state = deserialize("#rarity=rare+unique");
      expect(state.rarities).toEqual(new Set(["rare", "unique"]));
    });

    it("treats empty rarity param as all rarities", () => {
      const state = deserialize("#rarity=");
      expect(state.rarities.size).toBe(0);
    });

    it("parses remaster filter", () => {
      const state = deserialize("#remaster=legacy+remastered");
      expect(state.remaster).toEqual(new Set(["legacy", "remastered"]));
    });

    it("returns default remaster set when absent", () => {
      const state = deserialize("");
      expect(state.remaster).toEqual(new Set(["remastered"]));
    });

    it("treats empty remaster param as all content", () => {
      const state = deserialize("#remaster=");
      expect(state.remaster.size).toBe(0);
    });

    it("parses level range", () => {
      const state = deserialize("#minlvl=3&maxlvl=10");
      expect(state.minLevel).toBe("3");
      expect(state.maxLevel).toBe("10");
    });

    it("parses sort", () => {
      const state = deserialize("#sort=price%3Adesc");
      expect(state.sort).toBe("price:desc");
    });

    it("parses cart with mixed quantities", () => {
      const state = deserialize("#cart=sword-1%3A2+potion-1");
      expect(state.cart.get("sword-1")).toBe(2);
      expect(state.cart.get("potion-1")).toBe(1);
    });

    it("ignores invalid cart entries", () => {
      const state = deserialize("#cart=sword-1%3A0");
      expect(state.cart.size).toBe(0);
    });

    it("parses character name", () => {
      const state = deserialize("#char=Valeros");
      expect(state.charName).toBe("Valeros");
    });

    it("returns empty charName when absent", () => {
      const state = deserialize("");
      expect(state.charName).toBe("");
    });
  });

  describe("roundtrip", () => {
    it("roundtrips a complex state", () => {
      const state = {
        search: "healing",
        types: new Set(["consumable"]),
        rarities: new Set(["common"]),
        remaster: new Set(["legacy"]),
        minLevel: "1",
        maxLevel: "5",
        sort: "level:desc",
        charName: "Valeros",
        cart: new Map([
          ["potion-1", 3],
          ["elixir-2", 1],
        ]),
      };

      const hash = serialize(state);
      const parsed = deserialize(hash);

      expect(parsed.search).toBe(state.search);
      expect(parsed.types).toEqual(state.types);
      expect(parsed.rarities).toEqual(state.rarities);
      expect(parsed.remaster).toEqual(state.remaster);
      expect(parsed.minLevel).toBe(state.minLevel);
      expect(parsed.maxLevel).toBe(state.maxLevel);
      expect(parsed.sort).toBe(state.sort);
      expect(parsed.charName).toBe(state.charName);
      expect(parsed.cart).toEqual(state.cart);
    });
  });
});
