import type { CartEntry } from "../hooks/useCart";
import type { PriceModifier } from "../types";
import { aonUrl } from "./aon";
import { formatPrice } from "./price";

/**
 * Export cart entries as a CSV string.
 * Columns: Name, Quantity, Level, Base Price, Type, Modifier Type, Price Modifier, Notes, URL
 */
export function entriesToCsv(entries: CartEntry[]): string {
  const rows = [
    [
      "Name",
      "Quantity",
      "Level",
      "Base Price",
      "Category",
      "Modifier Type",
      "Price Modifier",
      "Notes",
      "URL",
    ],
  ];
  for (const { item, quantity, priceModifier, notes } of entries) {
    const isCustom = item.id.startsWith("custom-");
    rows.push([
      item.name,
      String(quantity),
      isCustom ? "" : String(item.level),
      formatPrice(item.price),
      isCustom ? "custom" : item.type,
      formatModifierType(priceModifier),
      formatPriceModifier(priceModifier),
      notes ?? "",
      isCustom ? "" : aonUrl(item),
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

/** Format the modifier type label for CSV export.
 *  Returns a human-readable label for preset modifiers, empty for custom/none. */
function formatModifierType(modifier: PriceModifier | undefined): string {
  if (!modifier) return "";
  if (modifier.type === "crafting") return "crafting";
  if (modifier.type === "sell") return "selling";
  if (modifier.type === "upgrade") return "upgrading";
  return "";
}

/** Format a price modifier for CSV export. */
function formatPriceModifier(modifier: PriceModifier | undefined): string {
  if (!modifier) return "";
  if (modifier.type === "percent") return `${modifier.percent}%`;
  if (modifier.type === "crafting") return "-50%";
  if (modifier.type === "sell") return "sell";
  // Flat/upgrade modifier in copper — express in the most natural denomination
  // Upgrade cp is always positive (discount), so negate for display
  const displayCp = modifier.type === "upgrade" ? -modifier.cp : modifier.cp;
  const sign = displayCp < 0 ? "-" : "";
  const { gp, sp, cp } = fromCopperForModifier(Math.abs(displayCp));
  const parts: string[] = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (cp) parts.push(`${cp} cp`);
  return parts.length > 0 ? `${sign}${parts.join(" ")}` : "";
}

/** Break copper pieces into gp/sp/cp for display. */
function fromCopperForModifier(totalCp: number): {
  gp: number;
  sp: number;
  cp: number;
} {
  const gp = Math.floor(totalCp / 100);
  const sp = Math.floor((totalCp % 100) / 10);
  const cp = totalCp % 10;
  return { gp, sp, cp };
}

/** Parse a price modifier string from CSV back into a PriceModifier. */
export function parsePriceModifier(s: string): PriceModifier | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;

  // Sell modifier
  if (trimmed.toLowerCase() === "sell") {
    return { type: "sell" };
  }

  // Percentage: "10%", "-25 %", "+10%"
  const pctMatch = trimmed.match(/^([+-]?\d+)\s*%$/);
  if (pctMatch) {
    return { type: "percent", percent: Number(pctMatch[1]) };
  }

  // Flat: "1 gp", "-5 gp", "1 gp 5 sp 3 cp", etc.
  // Check for leading sign
  const signMatch = trimmed.match(/^([+-])/);
  const sign = signMatch?.[1] === "-" ? -1 : 1;
  const gpMatch = trimmed.match(/(\d+)\s*gp/);
  const spMatch = trimmed.match(/(\d+)\s*sp/);
  const cpMatch = trimmed.match(/(\d+)\s*cp/);
  if (gpMatch || spMatch || cpMatch) {
    const totalCp =
      (gpMatch ? Number(gpMatch[1]) * 100 : 0) +
      (spMatch ? Number(spMatch[1]) * 10 : 0) +
      (cpMatch ? Number(cpMatch[1]) : 0);
    if (totalCp > 0) return { type: "flat", cp: sign * totalCp };
  }

  return undefined;
}

/** Escape a CSV field, quoting if it contains commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** A parsed CSV row representing an item to import. */
export interface CsvItem {
  name: string;
  quantity: number;
  /** Present when the CSV row has a Price Modifier/Discount column with a value. */
  priceModifier?: PriceModifier;
  /** Price string from CSV (e.g. "5 gp"). Present for custom items. */
  price?: string;
  /** Notes text from CSV, if any. */
  notes?: string;
  /** True when the CSV "Category" column is "custom". */
  isCustom: boolean;
}

/**
 * Parse a CSV string into an array of item descriptors.
 * Expects a "Name" column and optionally "Quantity", "Modifier Type",
 * "Price Modifier" (or "Discount"), "Category" (or "Type"), and "Base Price" (or "Price") columns.
 */
export function parseCsvItems(csv: string): CsvItem[] {
  const lines = parseCsvRows(csv);
  if (lines.length < 2) return [];

  const header = lines[0].map((h) => h.toLowerCase().trim());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return [];
  const qtyIdx = header.indexOf("quantity");
  const modifierTypeIdx = header.indexOf("modifier type");
  const modifierIdx = Math.max(
    header.indexOf("price modifier"),
    header.indexOf("discount"),
  );
  const typeIdx = Math.max(header.indexOf("category"), header.indexOf("type"));
  const priceIdx = Math.max(
    header.indexOf("base price"),
    header.indexOf("price"),
  );
  const notesIdx = header.indexOf("notes");

  const result: CsvItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const name = row[nameIdx]?.trim();
    if (!name) continue;
    const qty = qtyIdx >= 0 ? Number.parseInt(row[qtyIdx] ?? "1", 10) || 1 : 1;
    const modifierType =
      modifierTypeIdx >= 0 ? row[modifierTypeIdx]?.trim().toLowerCase() : "";
    const priceModifier = parseModifierFromRow(modifierType, modifierIdx, row);
    const typeStr = typeIdx >= 0 ? row[typeIdx]?.trim().toLowerCase() : "";
    const priceStr = priceIdx >= 0 ? row[priceIdx]?.trim() : undefined;
    const notesStr = notesIdx >= 0 ? row[notesIdx]?.trim() : undefined;
    const isCustom = typeStr === "custom";
    result.push({
      name,
      quantity: Math.max(1, qty),
      ...(priceModifier ? { priceModifier } : {}),
      ...(priceStr ? { price: priceStr } : {}),
      ...(notesStr ? { notes: notesStr } : {}),
      isCustom,
    });
  }
  return result;
}

/** Reconstruct a PriceModifier from the Modifier Type and Price Modifier columns. */
function parseModifierFromRow(
  modifierType: string,
  modifierIdx: number,
  row: string[],
): PriceModifier | undefined {
  if (modifierType === "crafting") return { type: "crafting" };
  if (modifierType === "selling") return { type: "sell" };
  if (modifierType === "upgrading") {
    // Parse the value column as an upgrade cp amount
    if (modifierIdx >= 0) {
      const flat = parsePriceModifier(row[modifierIdx] ?? "");
      if (flat?.type === "flat") return { type: "upgrade", cp: flat.cp };
    }
    return undefined;
  }
  // No modifier type column or empty — fall back to parsing the value column
  if (modifierIdx >= 0) return parsePriceModifier(row[modifierIdx] ?? "");
  return undefined;
}

/** Parse CSV text into rows of fields, handling quoted fields. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const row: string[] = [];
    while (i < len) {
      let field: string;
      if (text[i] === '"') {
        // Quoted field
        i++; // skip opening quote
        let value = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              value += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            value += text[i];
            i++;
          }
        }
        field = value;
      } else {
        // Unquoted field
        const start = i;
        while (
          i < len &&
          text[i] !== "," &&
          text[i] !== "\n" &&
          text[i] !== "\r"
        ) {
          i++;
        }
        field = text.slice(start, i);
      }
      row.push(field);

      if (i < len && text[i] === ",") {
        i++; // skip comma, continue to next field
      } else {
        break; // end of line or end of input
      }
    }
    // Skip line endings
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;
    rows.push(row);
  }

  return rows;
}
