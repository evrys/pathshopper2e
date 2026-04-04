import type { CartEntry } from "../hooks/useCart";
import { aonUrl } from "./aon";
import { formatPrice } from "./price";

/**
 * Export cart entries as a CSV string.
 * Columns: Name, Quantity, Level, Price, Type, URL
 */
export function entriesToCsv(entries: CartEntry[]): string {
  const rows = [["Name", "Quantity", "Level", "Price", "Type", "URL"]];
  for (const { item, quantity } of entries) {
    rows.push([
      item.name,
      String(quantity),
      String(item.level),
      formatPrice(item.price),
      item.type,
      aonUrl(item),
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

/** Escape a CSV field, quoting if it contains commas, quotes, or newlines. */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parse a CSV string into an array of { name, quantity } objects.
 * Expects a "Name" column and optionally a "Quantity" column.
 */
export function parseCsvItems(
  csv: string,
): { name: string; quantity: number }[] {
  const lines = parseCsvRows(csv);
  if (lines.length < 2) return [];

  const header = lines[0].map((h) => h.toLowerCase().trim());
  const nameIdx = header.indexOf("name");
  if (nameIdx === -1) return [];
  const qtyIdx = header.indexOf("quantity");

  const result: { name: string; quantity: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    const name = row[nameIdx]?.trim();
    if (!name) continue;
    const qty = qtyIdx >= 0 ? Number.parseInt(row[qtyIdx] ?? "1", 10) || 1 : 1;
    result.push({ name, quantity: Math.max(1, qty) });
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
