import type { Price, PriceModifier } from "../types";

/** Copper pieces per denomination: 1 gp = 10 sp = 100 cp */
export const CP_PER = { gp: 100, sp: 10, cp: 1 } as const;

/** Convert a Price to its total value in copper pieces */
export function toCopper(price: Price): number {
  return (
    (price.gp ?? 0) * CP_PER.gp + (price.sp ?? 0) * CP_PER.sp + (price.cp ?? 0)
  );
}

/** Resolve a PriceModifier to a signed copper adjustment (positive = surcharge, negative = discount). */
export function resolvePriceModifier(
  modifier: PriceModifier,
  price: Price,
): number {
  if (modifier.type === "flat") return modifier.cp;
  if (modifier.type === "upgrade") return -modifier.cp;
  if (modifier.type === "crafting") return -Math.round(0.5 * toCopper(price));
  return Math.round((modifier.percent / 100) * toCopper(price));
}

/** Convert copper pieces to a Price with the largest denominations */
export function fromCopper(cp: number): Price {
  const gp = Math.floor(cp / CP_PER.gp);
  cp -= gp * CP_PER.gp;
  const sp = Math.floor(cp / CP_PER.sp);
  cp -= sp * CP_PER.sp;

  const price: Price = {};
  if (gp) price.gp = gp;
  if (sp) price.sp = sp;
  if (cp) price.cp = cp;
  return price;
}

/** Format a Price as a human-readable string, e.g. "12 gp 5 sp".
 *  If a price modifier is provided, it adjusts the price (discount or surcharge). */
export function formatPrice(
  price: Price,
  priceModifier?: PriceModifier,
): string {
  let p = price;
  if (priceModifier) {
    const cp = Math.max(
      0,
      toCopper(price) + resolvePriceModifier(priceModifier, price),
    );
    p = fromCopper(cp);
  }
  const parts: string[] = [];
  if (p.gp) parts.push(`${p.gp} gp`);
  if (p.sp) parts.push(`${p.sp} sp`);
  if (p.cp) parts.push(`${p.cp} cp`);
  return parts.length > 0 ? parts.join(" ") : "—";
}

/** Parse a user-entered budget string like "140gp", "12 gp 5 sp", "1500" (assumes cp) */
export function parseBudget(input: string): Price | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Try structured format: "12 gp 5 sp 3 cp"
  const gpMatch = trimmed.match(/(\d+)\s*gp/);
  const spMatch = trimmed.match(/(\d+)\s*sp/);
  const cpMatch = trimmed.match(/(\d+)\s*cp/);

  if (gpMatch || spMatch || cpMatch) {
    const price: Price = {};
    if (gpMatch) price.gp = Number.parseInt(gpMatch[1], 10);
    if (spMatch) price.sp = Number.parseInt(spMatch[1], 10);
    if (cpMatch) price.cp = Number.parseInt(cpMatch[1], 10);
    return price;
  }

  // Plain number: assume gp
  const num = Number.parseFloat(trimmed);
  if (!Number.isNaN(num) && num >= 0) {
    return fromCopper(Math.round(num * CP_PER.gp));
  }

  return null;
}

/** Sum prices across entries with quantities and optional price modifiers, returning the total as a Price. */
export function sumPrices(
  entries: {
    price: Price;
    quantity: number;
    priceModifier?: PriceModifier;
  }[],
): Price {
  let totalCp = 0;
  for (const { price, quantity, priceModifier } of entries) {
    const adjustCp = priceModifier
      ? resolvePriceModifier(priceModifier, price)
      : 0;
    totalCp += Math.max(0, toCopper(price) + adjustCp) * quantity;
  }
  return fromCopper(Math.round(totalCp));
}
