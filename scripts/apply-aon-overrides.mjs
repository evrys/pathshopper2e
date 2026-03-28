/**
 * Applies all overrides from data/aon-url-overrides.json to
 * data/items.json and public/data/items.json.
 *
 * Usage: node scripts/apply-aon-overrides.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const overrides = JSON.parse(
  readFileSync("./data/aon-url-overrides.json", "utf-8"),
);

// Apply overrides to items
let applied = 0;
for (const item of items) {
  if (item.aonUrl) continue;
  const url = overrides[item.name];
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
