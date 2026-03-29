const AON_BASE = "https://2e.aonprd.com";

let traitUrls: Record<string, string> | null = null;

/** Load the trait→AoN URL map (cached after first call). */
export async function loadTraitUrls(): Promise<void> {
  if (traitUrls) return;
  try {
    const res = await fetch("/data/trait-urls.json");
    traitUrls = (await res.json()) as Record<string, string>;
  } catch (err) {
    console.error("Failed to load trait URLs:", err);
    traitUrls = {};
  }
}

/** Get the full AoN URL for a trait slug, or undefined if unknown. */
export function traitUrl(trait: string): string | undefined {
  const path = traitUrls?.[trait];
  return path ? `${AON_BASE}${path}` : undefined;
}

/** Format a trait slug like "deadly-d10" into a title-cased label "Deadly D10". */
export function formatTrait(trait: string): string {
  return trait.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
