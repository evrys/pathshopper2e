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

/**
 * Run a single uFuzzy search and return the ranked item indices with their
 * highlight ranges.  Returns an empty array when nothing matches.
 */
function searchOne(
  haystack: string[],
  needle: string,
): { idx: number; ranges: number[] }[] {
  const [idxs, info, order] = uf.search(haystack, needle);
  if (!idxs || idxs.length === 0) return [];

  if (!info || !order) {
    return idxs.map((idx) => ({ idx, ranges: [] }));
  }

  return order.map((orderIdx) => ({
    idx: info.idx[orderIdx],
    ranges: [...info.ranges[orderIdx]],
  }));
}

export interface FuzzyResult<T> {
  item: T;
  /** React nodes with <mark> around matched chars in the name, or null */
  highlighted: ReactNode | null;
  /** A highlighted snippet from the secondary text around the match, or null */
  secondarySnippet: ReactNode | null;
  /** Trait strings that matched the search needle (case-insensitive substring) */
  matchedTraits: Set<string>;
}

/**
 * Core ranking logic extracted as a pure function for testability.
 *
 * Priority order:
 *   strict name → trait-only → strict desc → fuzzy name → fuzzy desc
 */
export function rankSearch<T>(
  items: T[],
  names: string[],
  secondaries: string[],
  needle: string,
  getTraits?: (item: T) => string[],
): FuzzyResult<T>[] {
  const trimmed = needle.trim();
  const emptyTraits = new Set<string>();

  if (!trimmed) {
    return items.map((item) => ({
      item,
      highlighted: null,
      secondarySnippet: null,
      matchedTraits: emptyTraits,
    }));
  }

  const lowerNeedle = trimmed.toLowerCase();

  /** Return the set of traits that match the needle for a given item. */
  function traitMatches(idx: number): Set<string> {
    if (!getTraits) return emptyTraits;
    const traits = getTraits(items[idx]);
    const matched = new Set<string>();
    for (const t of traits) {
      // Normalize hyphens so "deadly d10" matches trait slug "deadly-d10"
      if (t.toLowerCase().replace(/-/g, " ").includes(lowerNeedle)) {
        matched.add(t);
      }
    }
    return matched;
  }

  // 1) Search names
  const nameHits = searchOne(names, trimmed);

  // 2) Search descriptions (if available)
  const secHits = secondaries.length > 0 ? searchOne(secondaries, trimmed) : [];

  // Build a quick lookup: idx → secHit
  const secHitMap = new Map(secHits.map((h) => [h.idx, h]));

  // Classify name hits as strict (substring) vs fuzzy
  const strictNameHits: typeof nameHits = [];
  const fuzzyNameHits: typeof nameHits = [];
  for (const hit of nameHits) {
    if (names[hit.idx].toLowerCase().includes(lowerNeedle)) {
      strictNameHits.push(hit);
    } else {
      fuzzyNameHits.push(hit);
    }
  }

  // Classify description-only hits as strict vs fuzzy
  const nameHitIdxs = new Set(nameHits.map((h) => h.idx));
  const strictSecHits: typeof secHits = [];
  const fuzzySecHits: typeof secHits = [];
  for (const hit of secHits) {
    if (nameHitIdxs.has(hit.idx)) continue; // already covered by name
    if (secondaries[hit.idx].toLowerCase().includes(lowerNeedle)) {
      strictSecHits.push(hit);
    } else {
      fuzzySecHits.push(hit);
    }
  }

  // 3) Collect trait-only matches (items not matched by name or description)
  const traitOnlyIdxs: number[] = [];
  if (getTraits) {
    const nameOrSecIdxs = new Set([
      ...nameHits.map((h) => h.idx),
      ...secHits.map((h) => h.idx),
    ]);
    for (let i = 0; i < items.length; i++) {
      if (nameOrSecIdxs.has(i)) continue;
      if (traitMatches(i).size > 0) {
        traitOnlyIdxs.push(i);
      }
    }
  }

  // 4) Merge in priority order:
  //    strict name → trait-only → strict desc → fuzzy name → fuzzy desc
  const seen = new Set<number>();
  const results: FuzzyResult<T>[] = [];

  function addNameHit(hit: { idx: number; ranges: number[] }) {
    if (seen.has(hit.idx)) return;
    seen.add(hit.idx);
    const name = names[hit.idx];
    const merged = mergeAdjacentRanges(hit.ranges, name);
    const highlighted =
      merged.length > 0 ? highlightRanges(name, merged) : null;

    let secondarySnippet: ReactNode | null = null;
    const secHit = secHitMap.get(hit.idx);
    if (secHit && secHit.ranges.length > 0) {
      secondarySnippet = buildSnippet(secondaries[hit.idx], secHit.ranges);
    }

    const matchedTraits = traitMatches(hit.idx);
    results.push({
      item: items[hit.idx],
      highlighted,
      secondarySnippet,
      matchedTraits,
    });
  }

  function addSecHit(hit: { idx: number; ranges: number[] }) {
    if (seen.has(hit.idx)) return;
    seen.add(hit.idx);

    let secondarySnippet: ReactNode | null = null;
    if (hit.ranges.length > 0) {
      secondarySnippet = buildSnippet(secondaries[hit.idx], hit.ranges);
    }

    const matchedTraits = traitMatches(hit.idx);
    results.push({
      item: items[hit.idx],
      highlighted: null,
      secondarySnippet,
      matchedTraits,
    });
  }

  for (const hit of strictNameHits) addNameHit(hit);
  for (const idx of traitOnlyIdxs) {
    seen.add(idx);
    results.push({
      item: items[idx],
      highlighted: null,
      secondarySnippet: null,
      matchedTraits: traitMatches(idx),
    });
  }
  for (const hit of strictSecHits) addSecHit(hit);
  for (const hit of fuzzyNameHits) addNameHit(hit);
  for (const hit of fuzzySecHits) addSecHit(hit);

  return results;
}

/**
 * Fuzzy-search a list of items by name, with an optional secondary text field
 * (e.g. description) that also participates in matching.
 *
 * Name matches are always ranked above description-only matches so that e.g.
 * searching "dragon" returns "Dragonbone Arrowhead" before items that merely
 * mention "dragon" in their description.
 */
export function useFuzzySearch<T>(
  items: T[],
  getName: (item: T) => string,
  needle: string,
  getSecondary?: (item: T) => string,
  getTraits?: (item: T) => string[],
): FuzzyResult<T>[] {
  const names = useMemo(() => items.map(getName), [items, getName]);
  const secondaries = useMemo(
    () => (getSecondary ? items.map(getSecondary) : []),
    [items, getSecondary],
  );

  return useMemo(
    () => rankSearch(items, names, secondaries, needle, getTraits),
    [items, names, secondaries, needle, getTraits],
  );
}
