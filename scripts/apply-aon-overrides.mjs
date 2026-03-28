/**
 * Merges /tmp/aon-found.json into data/aon-url-overrides.json,
 * then re-applies all overrides to data/items.json and public/data/items.json.
 *
 * Usage: node scripts/apply-aon-overrides.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

// Merge into overrides file
const existing = JSON.parse(
  readFileSync("./data/aon-url-overrides.json", "utf-8"),
);
const newFound = JSON.parse(readFileSync("/tmp/aon-found-pass2.json", "utf-8"));
const merged = { ...existing, ...newFound };

// Sort keys alphabetically
const sorted = Object.fromEntries(
  Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)),
);
writeFileSync(
  "./data/aon-url-overrides.json",
  JSON.stringify(sorted, null, 2) + "\n",
);
console.log(
  `Wrote ${Object.keys(sorted).length} entries to data/aon-url-overrides.json`,
);

// Apply overrides to items
let applied = 0;
for (const item of items) {
  if (item.aonUrl) continue;
  const url = sorted[item.name];
  if (url) {
    item.aonUrl = url;
    applied++;
  }
}

const stillMissing = items.filter((i) => !i.aonUrl).length;
console.log(
  `Applied ${applied} overrides. Still missing: ${stillMissing}/${items.length}`,
);

writeFileSync("./data/items.json", JSON.stringify(items));
writeFileSync("./public/data/items.json", JSON.stringify(items));
console.log("Wrote data/items.json and public/data/items.json");
