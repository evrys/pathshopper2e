/**
 * Patches missing AoN URLs in data/items.json using normalized name matching
 * against the AoN CSV. Run this instead of a full re-fetch when only the
 * URL matching logic has changed.
 *
 * Usage: node scripts/patch-aon-urls.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

function normalizeForMatch(name) {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

// Parse CSV
const csv = readFileSync("./data/aon-all-equipment.csv", "utf-8");
const lines = csv.split("\n");
const exact = new Map();
const normalized = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV parse (handles quoted fields)
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);

  const name = fields[0];
  const url = fields.at(-1);
  if (name && url && url.startsWith("/")) {
    if (!exact.has(name)) exact.set(name, url);
    const norm = normalizeForMatch(name);
    if (!normalized.has(norm)) normalized.set(norm, url);
  }
}

let exactCount = 0;
let normCount = 0;

for (const item of items) {
  if (item.aonUrl) continue;
  const url = exact.get(item.name);
  if (url) {
    item.aonUrl = url;
    exactCount++;
  } else {
    const normUrl = normalized.get(normalizeForMatch(item.name));
    if (normUrl) {
      item.aonUrl = normUrl;
      normCount++;
    }
  }
}

const stillMissing = items.filter((i) => !i.aonUrl);
console.log(
  `Patched ${exactCount} exact + ${normCount} normalized = ${exactCount + normCount} items`,
);
console.log(`Still missing: ${stillMissing.length}/${items.length}`);

writeFileSync("./data/items.json", JSON.stringify(items));
writeFileSync("./public/data/items.json", JSON.stringify(items));
console.log("Wrote data/items.json and public/data/items.json");
