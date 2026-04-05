import type { Item } from "../types";
import { toCopper } from "./price";

export interface UpgradeOption {
  /** Display name of the cheaper variant */
  name: string;
  /** Flat discount in copper pieces (the price of the cheaper variant) */
  priceCp: number;
  /** Formatted price string for display */
  priceDisplay: string;
}

/** Extract the variant base ID from an item ID, or null if the item has no variants. */
export function getVariantBaseId(id: string): string | null {
  const dot = id.indexOf(".");
  return dot >= 0 ? id.slice(0, dot) : null;
}

/**
 * Given an item and the full items list, return cheaper variants
 * that could serve as "upgrade from" discount sources.
 * Results are sorted by price descending (most expensive first).
 */
export function getUpgradeOptions(
  item: Item,
  allItems: Item[],
): UpgradeOption[] {
  const baseId = getVariantBaseId(item.id);
  if (!baseId) return [];

  const itemCp = toCopper(item.price);
  if (itemCp <= 0) return [];

  const options: UpgradeOption[] = [];

  for (const other of allItems) {
    if (other.id === item.id) continue;
    if (!other.id.startsWith(`${baseId}.`)) continue;

    const otherCp = toCopper(other.price);
    if (otherCp <= 0 || otherCp >= itemCp) continue;

    options.push({
      name: other.name,
      priceCp: otherCp,
      priceDisplay: formatCopperAsGp(otherCp),
    });
  }

  // Sort most expensive first (most likely upgrade source)
  options.sort((a, b) => b.priceCp - a.priceCp);
  return options;
}

/** Format a copper amount as a concise gp string for display in the dropdown. */
function formatCopperAsGp(cp: number): string {
  const gp = cp / 100;
  if (Number.isInteger(gp)) return `${gp} gp`;
  // Show sp/cp breakdown for sub-gp amounts
  const gpPart = Math.floor(cp / 100);
  const spPart = Math.floor((cp % 100) / 10);
  const cpPart = cp % 10;
  const parts: string[] = [];
  if (gpPart) parts.push(`${gpPart} gp`);
  if (spPart) parts.push(`${spPart} sp`);
  if (cpPart) parts.push(`${cpPart} cp`);
  return parts.join(" ") || "0 cp";
}
