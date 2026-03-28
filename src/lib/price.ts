import type { Price } from "../types";

/** 1 gp = 10 sp = 100 cp */
const CP_PER_SP = 10;
const CP_PER_GP = 100;

/** Convert a Price to its total value in copper pieces */
export function toCopper(price: Price): number {
  return (
    (price.gp ?? 0) * CP_PER_GP + (price.sp ?? 0) * CP_PER_SP + (price.cp ?? 0)
  );
}

/** Convert copper pieces to a Price with the largest denominations */
export function fromCopper(cp: number): Price {
  const gp = Math.floor(cp / CP_PER_GP);
  cp -= gp * CP_PER_GP;
  const sp = Math.floor(cp / CP_PER_SP);
  cp -= sp * CP_PER_SP;

  const price: Price = {};
  if (gp) price.gp = gp;
  if (sp) price.sp = sp;
  if (cp) price.cp = cp;
  return price;
}

/** Format a Price as a human-readable string, e.g. "12 gp 5 sp" */
export function formatPrice(price: Price): string {
  const parts: string[] = [];
  if (price.gp) parts.push(`${price.gp} gp`);
  if (price.sp) parts.push(`${price.sp} sp`);
  if (price.cp) parts.push(`${price.cp} cp`);
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
    return fromCopper(Math.round(num * CP_PER_GP));
  }

  return null;
}
