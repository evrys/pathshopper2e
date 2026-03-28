import { describe, expect, it } from "vitest";
import { aonUrl } from "./aon";
import type { Item } from "../types";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "test-id",
    name: "Longsword",
    type: "weapon",
    level: 0,
    price: { gp: 1 },
    category: "martial",
    traits: [],
    rarity: "common",
    bulk: 1,
    usage: "held-in-one-hand",
    source: "Pathfinder Player Core",
    remaster: true,
    description: "",
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

describe("dataset integration", () => {
  it("every item has an Archives of Nethys URL", async () => {
    const items = (await import("../../data/items.json")).default as Array<{
      name: string;
      type: string;
      aonUrl?: string;
    }>;

    const missing = items.filter((item) => !item.aonUrl);

    if (missing.length > 0) {
      const sample = missing
        .slice(0, 20)
        .map((item) => `  ${item.name} [${item.type}]`)
        .join("\n");
      const suffix =
        missing.length > 20 ? `\n  ... and ${missing.length - 20} more` : "";
      throw new Error(
        `${missing.length}/${items.length} items are missing an AoN URL:\n${sample}${suffix}`,
      );
    }
  });
});
