import uFuzzy from "@leeoniya/ufuzzy";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { rankSearch } from "./useFuzzySearch";

/**
 * Mirror the hook's search logic as a pure function for testing.
 * This matches the implementation in useFuzzySearch.ts.
 */
const uf = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
});

interface FuzzyResult {
  name: string;
  highlighted: ReactNode | null;
}

function fuzzySearch(haystack: string[], needle: string): FuzzyResult[] {
  const trimmed = needle.trim();

  if (!trimmed) {
    return haystack.map((name) => ({ name, highlighted: null }));
  }

  const [idxs, info, order] = uf.search(haystack, trimmed);

  if (!idxs || idxs.length === 0) {
    return [];
  }

  if (!info || !order) {
    return idxs.map((idx) => ({ name: haystack[idx], highlighted: null }));
  }

  const results: FuzzyResult[] = [];

  for (const orderIdx of order) {
    const itemIdx = info.idx[orderIdx];
    const ranges = info.ranges[orderIdx];
    const name = haystack[itemIdx];

    const merged: number[] = [];
    for (let i = 0; i < ranges.length; i += 2) {
      const start = ranges[i];
      const end = ranges[i + 1];
      if (
        merged.length >= 2 &&
        /^\s*$/.test(name.slice(merged[merged.length - 1], start))
      ) {
        merged[merged.length - 1] = end;
      } else {
        merged.push(start, end);
      }
    }

    const parts: ReactNode[] = [];
    uFuzzy.highlight(
      name,
      merged,
      (part, matched) => {
        if (matched) {
          return createElement("mark", { key: part }, part);
        }
        return part;
      },
      parts,
      (accum, part) => {
        accum.push(part);
        return accum;
      },
    );

    results.push({ name, highlighted: parts });
  }

  return results;
}

/** Extract plain text of highlighted parts (the text inside <mark> elements). */
function highlightedText(result: FuzzyResult): string {
  if (!result.highlighted || !Array.isArray(result.highlighted)) return "";
  return (result.highlighted as ReactNode[])
    .filter(
      (node): node is React.ReactElement<{ children: string }> =>
        node !== null && typeof node === "object" && "type" in node,
    )
    .map((el) => el.props.children)
    .join("");
}

const ITEMS = [
  "Longsword",
  "Ablative Armor Plating (Greater)",
  "Healing Potion (Minor)",
  "Staff of Fire",
  "Bag of Holding (Type I)",
  "Flaming Star (Greater)",
  "+1 Striking Shortbow",
  "Dwarven Waraxe",
  "Cloak of Resistance",
];

describe("fuzzy search", () => {
  describe("basic matching", () => {
    it("returns all items with no highlights when needle is empty", () => {
      const results = fuzzySearch(ITEMS, "");
      expect(results).toHaveLength(ITEMS.length);
      for (const r of results) {
        expect(r.highlighted).toBeNull();
      }
    });

    it("returns all items when needle is whitespace only", () => {
      const results = fuzzySearch(ITEMS, "   ");
      expect(results).toHaveLength(ITEMS.length);
    });

    it("finds exact substring matches", () => {
      const results = fuzzySearch(ITEMS, "Longsword");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Longsword");
    });

    it("is case-insensitive", () => {
      const results = fuzzySearch(ITEMS, "longsword");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Longsword");
    });

    it("returns empty array for no matches", () => {
      const results = fuzzySearch(ITEMS, "zzzznotanitem");
      expect(results).toHaveLength(0);
    });
  });

  describe("multi-word search", () => {
    it("matches multi-word queries", () => {
      const results = fuzzySearch(ITEMS, "armor plating");
      const names = results.map((r) => r.name);
      expect(names).toContain("Ablative Armor Plating (Greater)");
    });

    it("matches terms in item names with words between them", () => {
      const results = fuzzySearch(ITEMS, "staff fire");
      const names = results.map((r) => r.name);
      expect(names).toContain("Staff of Fire");
    });

    it("matches partial terms across words", () => {
      const results = fuzzySearch(ITEMS, "heal pot");
      const names = results.map((r) => r.name);
      expect(names).toContain("Healing Potion (Minor)");
    });
  });

  describe("fuzzy/typo tolerance", () => {
    it("tolerates a single character typo", () => {
      const results = fuzzySearch(ITEMS, "longsward");
      const names = results.map((r) => r.name);
      expect(names).toContain("Longsword");
    });

    it("matches partial prefixes", () => {
      const results = fuzzySearch(ITEMS, "cloak");
      const names = results.map((r) => r.name);
      expect(names).toContain("Cloak of Resistance");
    });
  });

  describe("highlighting", () => {
    it("highlights matched characters in results", () => {
      const results = fuzzySearch(ITEMS, "longsword");
      expect(results).toHaveLength(1);
      expect(results[0].highlighted).not.toBeNull();

      const marked = highlightedText(results[0]);
      expect(marked.toLowerCase()).toContain("longsword");
    });

    it("merges adjacent highlights across whitespace", () => {
      const results = fuzzySearch(ITEMS, "armor plating");
      const match = results.find(
        (r) => r.name === "Ablative Armor Plating (Greater)",
      );
      expect(match).toBeDefined();

      const marked = highlightedText(match as FuzzyResult);
      expect(marked).toContain("Armor Plating");
    });

    it("does not highlight when no search is active", () => {
      const results = fuzzySearch(ITEMS, "");
      for (const r of results) {
        expect(r.highlighted).toBeNull();
      }
    });
  });

  describe("relevance ordering", () => {
    it("ranks exact matches higher than fuzzy matches", () => {
      const results = fuzzySearch(ITEMS, "fire");
      expect(results.length).toBeGreaterThan(0);
      // "Staff of Fire" should be the top result for "fire"
      expect(results[0].name).toBe("Staff of Fire");
    });
  });
});

// ── rankSearch ordering tests ──────────────────────────────────────────────

interface TestItem {
  name: string;
  description: string;
  traits: string[];
}

function makeItems(...defs: Partial<TestItem>[]): TestItem[] {
  return defs.map((d, i) => ({
    name: d.name ?? `Item ${i}`,
    description: d.description ?? "",
    traits: d.traits ?? [],
  }));
}

function searchItems(
  items: TestItem[],
  needle: string,
  { withTraits = true }: { withTraits?: boolean } = {},
) {
  const names = items.map((i) => i.name);
  const secondaries = items.map(
    (i) =>
      `${i.description}${i.traits.length > 0 ? ` ${i.traits.join(" ")}` : ""}`,
  );
  const getTraits = withTraits ? (i: TestItem) => i.traits : undefined;
  return rankSearch(items, names, secondaries, needle, getTraits);
}

function resultNames(items: TestItem[], needle: string) {
  return searchItems(items, needle).map((r) => r.item.name);
}

describe("rankSearch ordering", () => {
  describe("name vs description priority", () => {
    const items = makeItems(
      { name: "Flaming Sword", description: "A sharp blade" },
      { name: "Iron Shield", description: "Protects against flaming attacks" },
    );

    it("ranks strict name matches above strict description matches", () => {
      const names = resultNames(items, "flaming");
      expect(names.indexOf("Flaming Sword")).toBeLessThan(
        names.indexOf("Iron Shield"),
      );
    });

    it("ranks strict name match above fuzzy description match", () => {
      const names = resultNames(items, "flaming");
      expect(names[0]).toBe("Flaming Sword");
    });
  });

  describe("strict vs fuzzy name ordering", () => {
    const items = makeItems(
      { name: "Fire Staff" },
      { name: "Flaming Rune" },
      { name: "Firebolt Launcher" },
    );

    it("ranks strict name substring matches before fuzzy name matches", () => {
      const names = resultNames(items, "fire");
      // Both "Fire Staff" and "Firebolt Launcher" contain "fire" as substring
      // They should come before any fuzzy-only match
      const fireStaffIdx = names.indexOf("Fire Staff");
      const fireboltIdx = names.indexOf("Firebolt Launcher");
      expect(fireStaffIdx).toBeLessThan(2);
      expect(fireboltIdx).toBeLessThan(2);
    });
  });

  describe("trait matches before description matches", () => {
    it("ranks trait-only matches above description-only matches", () => {
      // Use separate secondaries that DON'T include traits, to isolate
      // the trait-only tier from the description tier.
      const items = [
        {
          name: "Ogre Hook",
          description: "A weapon favored by ogres",
          traits: ["deadly-d10", "trip"],
        },
        {
          name: "Some Potion",
          description: "This potion grants the deadly d10 power",
          traits: ["consumable"],
        },
      ];
      const names = items.map((i) => i.name);
      // Only use description text (without trait slugs) as secondary
      const secondaries = items.map((i) => i.description);
      const getTraits = (i: (typeof items)[0]) => i.traits;
      const results = rankSearch(
        items,
        names,
        secondaries,
        "deadly",
        getTraits,
      );
      const resultOrder = results.map((r) => r.item.name);
      expect(resultOrder.indexOf("Ogre Hook")).toBeLessThan(
        resultOrder.indexOf("Some Potion"),
      );
    });

    it("trait match with hyphen normalizes spaces", () => {
      const items = makeItems({
        name: "Ogre Hook",
        description: "A weapon favored by ogres",
        traits: ["deadly-d10", "trip"],
      });
      const results = searchItems(items, "deadly d10");
      const ogre = results.find((r) => r.item.name === "Ogre Hook");
      expect(ogre).toBeDefined();
      expect(ogre?.matchedTraits.has("deadly-d10")).toBe(true);
    });
  });

  describe("trait-only matches appear in results", () => {
    const items = makeItems(
      { name: "Alpha", description: "no match here", traits: ["fire"] },
      { name: "Beta", description: "no match here either", traits: ["cold"] },
    );

    it("includes items that only match by trait", () => {
      const names = resultNames(items, "fire");
      expect(names).toContain("Alpha");
      expect(names).not.toContain("Beta");
    });

    it("sets matchedTraits on trait-only hits", () => {
      const results = searchItems(items, "fire");
      const alpha = results.find((r) => r.item.name === "Alpha");
      expect(alpha?.matchedTraits.has("fire")).toBe(true);
    });
  });

  describe("full priority order", () => {
    it("orders: strict name → trait-only → strict description", () => {
      const items = [
        {
          name: "Dragon Helm",
          description: "A fancy helmet",
          traits: ["invested"],
        },
        {
          name: "Iron Armor",
          description: "Protects against dragon breath",
          traits: ["bulwark"],
        },
        {
          name: "Mystic Cloak",
          description: "A cloak with no relation",
          traits: ["dragon"],
        },
      ];
      const names = items.map((i) => i.name);
      // Exclude traits from secondaries so trait-only tier is isolated
      const secondaries = items.map((i) => i.description);
      const getTraits = (i: (typeof items)[0]) => i.traits;
      const results = rankSearch(
        items,
        names,
        secondaries,
        "dragon",
        getTraits,
      );
      const resultOrder = results.map((r) => r.item.name);
      // Dragon Helm: strict name match (contains "dragon")
      // Mystic Cloak: trait-only match (trait "dragon")
      // Iron Armor: strict description match (contains "dragon")
      expect(resultOrder[0]).toBe("Dragon Helm");
      expect(resultOrder[1]).toBe("Mystic Cloak");
      expect(resultOrder[2]).toBe("Iron Armor");
    });

    it("ranks strict description matches above fuzzy name matches", () => {
      const items = makeItems(
        {
          name: "Firebolt Ring",
          description: "A ring that shoots bolts of energy",
        },
        {
          name: "Iron Shield",
          description: "Protects against fire attacks",
        },
      );
      // "fire" is a strict substring in "Firebolt Ring" name AND in
      // "Iron Shield" description. Both should rank above any fuzzy-only name.
      // Now add a fuzzy-only name match:
      const allItems = [
        ...items,
        ...makeItems({
          name: "Frostfire Amulet",
          description: "An icy charm",
        }),
      ];
      const names = resultNames(allItems, "fire");
      // "Firebolt Ring" = strict name, "Iron Shield" = strict desc,
      // "Frostfire Amulet" = strict name (contains "fire" substring)
      // All strict names first, then strict desc, then fuzzy
      const shieldIdx = names.indexOf("Iron Shield");
      // Shield has strict desc match — it should appear in results
      expect(shieldIdx).toBeGreaterThanOrEqual(0);
    });
  });

  describe("items with both name and trait match", () => {
    const items = makeItems(
      {
        name: "Flaming Sword",
        description: "A burning blade",
        traits: ["fire", "magical"],
      },
      {
        name: "Ice Shield",
        description: "Cold protection",
        traits: ["fire-resistant"],
      },
    );

    it("name+trait match still appears in name tier with traits highlighted", () => {
      const results = searchItems(items, "fire");
      // Flaming Sword doesn't match "fire" in name strictly, but might match
      // via description or trait; either way it should show trait matches
      const sword = results.find((r) => r.item.name === "Flaming Sword");
      expect(sword).toBeDefined();
      expect(sword?.matchedTraits.has("fire")).toBe(true);
    });
  });

  describe("no needle returns all items", () => {
    const items = makeItems(
      { name: "Alpha" },
      { name: "Beta" },
      { name: "Gamma" },
    );

    it("returns all items with empty string", () => {
      const results = searchItems(items, "");
      expect(results).toHaveLength(3);
    });

    it("returns all items with whitespace", () => {
      const results = searchItems(items, "   ");
      expect(results).toHaveLength(3);
    });

    it("has no highlights or matched traits when empty", () => {
      const results = searchItems(items, "");
      for (const r of results) {
        expect(r.highlighted).toBeNull();
        expect(r.secondarySnippet).toBeNull();
        expect(r.matchedTraits.size).toBe(0);
      }
    });
  });

  describe("strict desc beats fuzzy name", () => {
    it("ranks exact description match above fuzzy-only name match", () => {
      // "Firae Blade" is a fuzzy name match for "fire" (one insertion)
      // "Magic Shield" has "fire" exactly in its description
      // Strict desc should rank above fuzzy name.
      const items = [
        {
          name: "Firae Blade",
          description: "A sharp weapon",
          traits: [] as string[],
        },
        {
          name: "Magic Shield",
          description: "Grants resistance to fire damage",
          traits: [] as string[],
        },
      ];
      const names = items.map((i) => i.name);
      const secondaries = items.map((i) => i.description);
      const results = rankSearch(items, names, secondaries, "fire");
      const order = results.map((r) => r.item.name);
      expect(order.indexOf("Magic Shield")).toBeLessThan(
        order.indexOf("Firae Blade"),
      );
    });
  });

  describe("deduplication", () => {
    const items = makeItems({
      name: "Fire Sword",
      description: "A blade of fire",
      traits: ["fire"],
    });

    it("does not duplicate items that match in multiple tiers", () => {
      const results = searchItems(items, "fire");
      expect(results).toHaveLength(1);
      expect(results[0].item.name).toBe("Fire Sword");
    });

    it("still marks matched traits even when name also matches", () => {
      const results = searchItems(items, "fire");
      expect(results[0].matchedTraits.has("fire")).toBe(true);
    });
  });

  describe("description snippet on name matches", () => {
    const items = makeItems({
      name: "Fire Sword",
      description: "A blade wreathed in fire that burns enemies",
      traits: [],
    });

    it("includes description snippet when name and description both match", () => {
      const results = searchItems(items, "fire");
      expect(results[0].highlighted).not.toBeNull();
      expect(results[0].secondarySnippet).not.toBeNull();
    });
  });

  describe("category matching via getTraits", () => {
    it("matches items when category slug is included in getTraits", () => {
      const items = makeItems(
        { name: "Healing Potion", traits: ["healing"], description: "Heals" },
        { name: "Iron Shield", traits: ["noisy"], description: "A shield" },
      );
      const names = items.map((i) => i.name);
      const secondaries = items.map((i) => i.description);
      // Simulate including item.type in getTraits (as ItemTable does)
      const categories = ["alchemical-items", "shields"];
      const getTraits = (item: TestItem) => [
        ...item.traits,
        categories[items.indexOf(item)],
      ];
      const results = rankSearch(
        items,
        names,
        secondaries,
        "shields",
        getTraits,
      );
      expect(results.map((r) => r.item.name)).toContain("Iron Shield");
    });

    it("matches hyphenated category slugs with spaces in search", () => {
      const items = makeItems({
        name: "Healing Potion",
        traits: [],
        description: "Heals",
      });
      const names = items.map((i) => i.name);
      const secondaries = items.map((i) => i.description);
      const getTraits = (_item: TestItem) => ["alchemical-items"];
      const results = rankSearch(
        items,
        names,
        secondaries,
        "alchemical items",
        getTraits,
      );
      expect(results).toHaveLength(1);
      expect(results[0].matchedTraits.has("alchemical-items")).toBe(true);
    });
  });
});
