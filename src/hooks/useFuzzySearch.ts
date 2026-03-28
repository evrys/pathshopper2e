import uFuzzy from "@leeoniya/ufuzzy";
import type { ReactNode } from "react";
import { createElement, useMemo } from "react";

const uf = new uFuzzy({
  intraMode: 1, // allow single typos per term
  intraIns: 1,
});

/** Merge highlight ranges that are adjacent or separated only by whitespace. */
function mergeAdjacentRanges(ranges: number[], text: string): number[] {
  const merged: number[] = [];
  for (let i = 0; i < ranges.length; i += 2) {
    const start = ranges[i];
    const end = ranges[i + 1];
    if (
      merged.length >= 2 &&
      /^\s*$/.test(text.slice(merged[merged.length - 1], start))
    ) {
      merged[merged.length - 1] = end;
    } else {
      merged.push(start, end);
    }
  }
  return merged;
}

/** Produce ReactNode[] with <mark> around the given ranges in `text`. */
function highlightRanges(text: string, ranges: number[]): ReactNode[] {
  const parts: ReactNode[] = [];
  uFuzzy.highlight(
    text,
    ranges,
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
  return parts;
}

/** Max characters on each side of the match to include in a snippet. */
const SNIPPET_CONTEXT = 48;

/**
 * Build a "…prefix <mark>match</mark> suffix…" snippet around the first
 * matched range in `text`.  `ranges` are start/end pairs in text-local coords.
 */
function buildSnippet(text: string, ranges: number[]): ReactNode[] {
  if (ranges.length < 2) return [];

  // Find the bounding span of all matched ranges
  let minStart = ranges[0];
  let maxEnd = ranges[1];
  for (let i = 2; i < ranges.length; i += 2) {
    minStart = Math.min(minStart, ranges[i]);
    maxEnd = Math.max(maxEnd, ranges[i + 1]);
  }

  // Expand to include surrounding context, snapping to word boundaries
  let sliceStart = Math.max(0, minStart - SNIPPET_CONTEXT);
  let sliceEnd = Math.min(text.length, maxEnd + SNIPPET_CONTEXT);

  // Snap to word boundaries (don't cut mid-word)
  if (sliceStart > 0) {
    const spaceIdx = text.indexOf(" ", sliceStart);
    if (spaceIdx !== -1 && spaceIdx < minStart) sliceStart = spaceIdx + 1;
  }
  if (sliceEnd < text.length) {
    const spaceIdx = text.lastIndexOf(" ", sliceEnd);
    if (spaceIdx > maxEnd) sliceEnd = spaceIdx;
  }

  const snippet = text.slice(sliceStart, sliceEnd);

  // Shift ranges into snippet-local coords and clamp
  const localRanges: number[] = [];
  for (let i = 0; i < ranges.length; i += 2) {
    const s = Math.max(0, ranges[i] - sliceStart);
    const e = Math.min(snippet.length, ranges[i + 1] - sliceStart);
    if (s < e) localRanges.push(s, e);
  }

  const merged = mergeAdjacentRanges(localRanges, snippet);
  const parts: ReactNode[] = [];

  if (sliceStart > 0) parts.push("…");
  parts.push(...highlightRanges(snippet, merged));
  if (sliceEnd < text.length) parts.push("…");

  return parts;
}

export interface FuzzyResult<T> {
  item: T;
  /** React nodes with <mark> around matched chars in the name, or null */
  highlighted: ReactNode | null;
  /** A highlighted snippet from the secondary text around the match, or null */
  secondarySnippet: ReactNode | null;
}

/**
 * Fuzzy-search a list of items by a string key, with an optional secondary
 * text field (e.g. description) that participates in matching but is not
 * highlighted.
 *
 * Returns items in relevance order when a needle is provided,
 * or all items (with highlighted=null) when needle is empty.
 */
export function useFuzzySearch<T>(
  items: T[],
  getName: (item: T) => string,
  needle: string,
  getSecondary?: (item: T) => string,
): FuzzyResult<T>[] {
  /** Just the names — used for highlighting. */
  const names = useMemo(() => items.map(getName), [items, getName]);

  /**
   * Combined haystack for uFuzzy: "name\nsecondaryText".
   * The newline prevents cross-field fuzzy bleeding.
   */
  const haystack = useMemo(
    () =>
      getSecondary
        ? items.map((item, i) => `${names[i]}\n${getSecondary(item)}`)
        : names,
    [items, names, getSecondary],
  );

  return useMemo(() => {
    const trimmed = needle.trim();

    if (!trimmed) {
      return items.map((item) => ({
        item,
        highlighted: null,
        secondarySnippet: null,
      }));
    }

    const [idxs, info, order] = uf.search(haystack, trimmed);

    if (!idxs || idxs.length === 0) {
      return [];
    }

    // When info/order are available, use ranked results with highlights.
    // When null (too many results for ranking), fall back to unranked filter matches.
    if (!info || !order) {
      return idxs.map((idx) => ({
        item: items[idx],
        highlighted: null,
        secondarySnippet: null,
      }));
    }

    const results: FuzzyResult<T>[] = [];

    for (const orderIdx of order) {
      const itemIdx = info.idx[orderIdx];
      const ranges = info.ranges[orderIdx];
      const item = items[itemIdx];
      const name = names[itemIdx];
      const nameLen = name.length;
      // +1 to skip the \n separator
      const secondaryOffset = nameLen + 1;

      // Split ranges into name vs secondary portions
      const nameRanges: number[] = [];
      const secRanges: number[] = [];
      for (let i = 0; i < ranges.length; i += 2) {
        const start = ranges[i];
        const end = ranges[i + 1];
        if (start >= secondaryOffset) {
          // Entirely in secondary text — shift to secondary-local coords
          secRanges.push(start - secondaryOffset, end - secondaryOffset);
        } else if (end <= nameLen) {
          nameRanges.push(start, end);
        } else {
          // Spans the boundary — clamp each side
          nameRanges.push(start, nameLen);
          secRanges.push(0, end - secondaryOffset);
        }
      }

      // ── Name highlighting ──
      const merged = mergeAdjacentRanges(nameRanges, name);
      let highlighted: ReactNode | null = null;
      if (merged.length > 0) {
        highlighted = highlightRanges(name, merged);
      }

      // ── Secondary snippet ──
      let secondarySnippet: ReactNode | null = null;
      if (getSecondary && secRanges.length > 0) {
        const secondary = getSecondary(item);
        secondarySnippet = buildSnippet(secondary, secRanges);
      }

      results.push({ item, highlighted, secondarySnippet });
    }

    return results;
  }, [items, names, haystack, needle, getSecondary]);
}
