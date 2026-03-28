import uFuzzy from "@leeoniya/ufuzzy";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

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
