/**
 * Formatting utilities for Pathfinder 2e item display fields.
 */

/** Worn slots that are concatenated without a separator in the raw data. */
const WORN_SLOTS = new Set([
  "amulet",
  "anklets",
  "armbands",
  "backpack",
  "belt",
  "boots",
  "bracelet",
  "bracers",
  "cap",
  "cape",
  "circlet",
  "cloak",
  "clothing",
  "collar",
  "crown",
  "epaulet",
  "eyeglasses",
  "eyepiece",
  "footwear",
  "garment",
  "gloves",
  "headwear",
  "horseshoes",
  "mask",
  "necklace",
  "ring",
  "saddle",
  "sandles",
  "shoes",
]);

/** Format a kebab-case usage string into a human-readable label. */
export function formatUsage(usage: string): string {
  // Handle "worn<slot>" concatenated values (e.g. "wornbracers" → "worn bracers")
  if (usage.startsWith("worn")) {
    const slot = usage.slice("worn".length);
    if (WORN_SLOTS.has(slot)) {
      return `worn ${slot}`.replace(/-/g, " ").replace(/\bwo\b/g, "w/o");
    }
  }

  return usage.replace(/-/g, " ").replace(/\bwo\b/g, "w/o");
}
