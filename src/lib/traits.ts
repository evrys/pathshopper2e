import { AON_BASE } from "./aon";

interface TraitEntry {
  url: string;
  description: string;
}

let traitData: Record<string, TraitEntry> | null = null;

/** Load the trait data map (cached after first call). */
export async function loadTraitData(): Promise<void> {
  if (traitData) return;
  try {
    const res = await fetch("./data/traits.json");
    traitData = (await res.json()) as Record<string, TraitEntry>;
  } catch (err) {
    console.error("Failed to load trait data:", err);
    traitData = {};
  }
}

/** Get the full AoN URL for a trait slug, or undefined if unknown. */
export function traitUrl(trait: string): string | undefined {
  const entry = traitData?.[trait];
  return entry?.url ? `${AON_BASE}${entry.url}` : undefined;
}

/** Format a trait slug like "deadly-d10" into a title-cased label "Deadly D10". */
export function formatTrait(trait: string): string {
  return trait.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
