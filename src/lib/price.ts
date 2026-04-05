import type { Discount, Price } from "../types";

/** Copper pieces per denomination: 1 gp = 10 sp = 100 cp */
export const CP_PER = { gp: 100, sp: 10, cp: 1 } as const;

/** Convert a Price to its total value in copper pieces */
export function toCopper(price: Price): number {
  return (
    (price.gp ?? 0) * CP_PER.gp + (price.sp ?? 0) * CP_PER.sp + (price.cp ?? 0)
  );
}

/** Resolve a Discount to an absolute copper value given the item's price. */
export function resolveDiscount(discount: Discount, price: Price): number {
  if (discount.type === "flat") return discount.cp;
  return Math.round((discount.percent / 100) * toCopper(price));
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
 *  If a discount is provided, it is subtracted from the price. */
export function formatPrice(price: Price, discount?: Discount): string {
  let p = price;
  if (discount) {
    const cp = Math.max(0, toCopper(price) - resolveDiscount(discount, price));
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

/** Sum prices across entries with quantities and optional discounts, returning the total as a Price. */
export function sumPrices(
  entries: { price: Price; quantity: number; discount?: Discount }[],
): Price {
  let totalCp = 0;
  for (const { price, quantity, discount } of entries) {
    const discountCp = discount ? resolveDiscount(discount, price) : 0;
    totalCp += Math.max(0, toCopper(price) - discountCp) * quantity;
  }
  return fromCopper(Math.round(totalCp));
}
