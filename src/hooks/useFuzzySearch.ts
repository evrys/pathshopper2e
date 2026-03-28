import uFuzzy from "@leeoniya/ufuzzy";
import type { ReactNode } from "react";
import { createElement, useMemo } from "react";

const uf = new uFuzzy({
  intraMode: 1, // allow single typos per term
  intraIns: 1,
});

export interface FuzzyResult<T> {
  item: T;
  /** React nodes with <mark> around matched chars, or null if no search active */
  highlighted: ReactNode | null;
}

/**
 * Fuzzy-search a list of items by a string key.
 * Returns items in relevance order when a needle is provided,
 * or all items (with highlighted=null) when needle is empty.
 */
export function useFuzzySearch<T>(
  items: T[],
  getName: (item: T) => string,
  needle: string,
): FuzzyResult<T>[] {
  const haystack = useMemo(() => items.map(getName), [items, getName]);

  return useMemo(() => {
    const trimmed = needle.trim();

    if (!trimmed) {
      return items.map((item) => ({ item, highlighted: null }));
    }

    const [idxs, info, order] = uf.search(haystack, trimmed);

    if (!idxs || idxs.length === 0) {
      return [];
    }

    // When info/order are available, use ranked results with highlights.
    // When null (too many results for ranking), fall back to unranked filter matches.
    if (!info || !order) {
      return idxs.map((idx) => ({ item: items[idx], highlighted: null }));
    }

    const results: FuzzyResult<T>[] = [];

    for (const orderIdx of order) {
      const itemIdx = info.idx[orderIdx];
      const ranges = info.ranges[orderIdx];
      const item = items[itemIdx];
      const name = haystack[itemIdx];

      // Merge ranges that are adjacent or separated only by whitespace,
      // so "armor plating" highlights as one continuous span including the space.
      const merged: number[] = [];
      for (let i = 0; i < ranges.length; i += 2) {
        const start = ranges[i];
        const end = ranges[i + 1];
        if (
          merged.length >= 2 &&
          /^\s*$/.test(name.slice(merged[merged.length - 1], start))
        ) {
          // Extend previous range to cover the gap + this range
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

      results.push({ item, highlighted: parts });
    }

    return results;
  }, [items, haystack, needle]);
}
