import type { CartEntry } from "../hooks/useCart";
import { aonUrl } from "./aon";
import { formatPrice } from "./price";
import type { Discount } from "../types";

/**
 * Export cart entries as a CSV string.
 * Columns: Name, Quantity, Level, Price, Type, Discount, URL
 */
export function entriesToCsv(entries: CartEntry[]): string {
  const rows = [
    ["Name", "Quantity", "Level", "Price", "Type", "Discount", "URL"],
  ];
  for (const { item, quantity, discount } of entries) {
    const isCustom = item.id.startsWith("custom-");
    rows.push([
      item.name,
      String(quantity),
      isCustom ? "" : String(item.level),
      formatPrice(item.price),
      isCustom ? "custom" : item.type,
      formatDiscount(discount),
      isCustom ? "" : aonUrl(item),
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

/** Format a discount for CSV export. */
function formatDiscount(discount: Discount | undefined): string {
  if (!discount) return "";
  if (discount.type === "percent") return `${discount.percent}%`;
  // Flat discount in copper — express in the most natural denomination
  const { gp, sp, cp } = fromCopperForDiscount(discount.cp);
  const parts: string[] = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (cp) parts.push(`${cp} cp`);
  return parts.join(" ");
}

/** Break copper pieces into gp/sp/cp for display. */
function fromCopperForDiscount(totalCp: number): {
  gp: number;
  sp: number;
  cp: number;
} {
  const gp = Math.floor(totalCp / 100);
  const sp = Math.floor((totalCp % 100) / 10);
  const cp = totalCp % 10;
  return { gp, sp, cp };
}

/** Parse a discount string from CSV back into a Discount. */
export function parseDiscount(s: string): Discount | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;

  // Percentage: "10%", "25 %"
  const pctMatch = trimmed.match(/^(\d+)\s*%$/);
  if (pctMatch) {
    return { type: "percent", percent: Number(pctMatch[1]) };
  }

  // Flat: "1 gp", "5 sp", "1 gp 5 sp 3 cp", etc.
  const gpMatch = trimmed.match(/(\d+)\s*gp/);
  const spMatch = trimmed.match(/(\d+)\s*sp/);
  const cpMatch = trimmed.match(/(\d+)\s*cp/);
  if (gpMatch || spMatch || cpMatch) {
    const totalCp =
      (gpMatch ? Number(gpMatch[1]) * 100 : 0) +
      (spMatch ? Number(spMatch[1]) * 10 : 0) +
      (cpMatch ? Number(cpMatch[1]) : 0);
    if (totalCp > 0) return { type: "flat", cp: totalCp };
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
  /** Present when the CSV row has a Discount column with a value. */
  discount?: Discount;
  /** Price string from CSV (e.g. "5 gp"). Present for custom items. */
  price?: string;
  /** True when the CSV "Type" column is "custom". */
  isCustom: boolean;
}

/**
 * Parse a CSV string into an array of item descriptors.
 * Expects a "Name" column and optionally "Quantity", "Discount", "Type",
 * and "Price" columns.
 */
export function parseCsvItems(csv: string): CsvItem[] {
  const lines = parseCsvRows(csv);
  if (lines.length < 2) return [];

  const header = lines[0].map((h) => h.toLowerCase().trim());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return [];
  const qtyIdx = header.indexOf("quantity");
  const discountIdx = header.indexOf("discount");
  const typeIdx = header.indexOf("type");
  const priceIdx = header.indexOf("price");

  const result: CsvItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const name = row[nameIdx]?.trim();
    if (!name) continue;
    const qty = qtyIdx >= 0 ? Number.parseInt(row[qtyIdx] ?? "1", 10) || 1 : 1;
    const discount =
      discountIdx >= 0 ? parseDiscount(row[discountIdx] ?? "") : undefined;
    const typeStr = typeIdx >= 0 ? row[typeIdx]?.trim().toLowerCase() : "";
    const priceStr = priceIdx >= 0 ? row[priceIdx]?.trim() : undefined;
    const isCustom = typeStr === "custom";
    result.push({
      name,
      quantity: Math.max(1, qty),
      ...(discount ? { discount } : {}),
      ...(priceStr ? { price: priceStr } : {}),
      isCustom,
    });
  }
  return result;
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
