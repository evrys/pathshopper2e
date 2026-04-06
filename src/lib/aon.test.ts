import { describe, expect, it } from "vitest";
import type { Item } from "../types";
import { aonUrl } from "./aon";

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
    sourceId: "1",
    sourceCategory: "Rulebooks",
    remaster: true,
    description: "",
    plainDescription: "",
    ...overrides,
  };
}

describe("aonUrl", () => {
  it("returns stored AoN URL when available", () => {
    const item = makeItem({ aonUrl: "/Weapons.aspx?ID=386" });
    expect(aonUrl(item)).toBe("https://2e.aonprd.com/Weapons.aspx?ID=386");
  });

  it("falls back to search URL when no stored URL", () => {
    const item = makeItem({ aonUrl: undefined });
    expect(aonUrl(item)).toBe("https://2e.aonprd.com/Search.aspx?q=Longsword");
  });

  it("encodes special characters in search fallback", () => {
    const item = makeItem({
      name: "Healing Potion (Minor)",
      aonUrl: undefined,
    });
    expect(aonUrl(item)).toBe(
      "https://2e.aonprd.com/Search.aspx?q=Healing%20Potion%20(Minor)",
    );
  });
});
