/**
 * Dumps all items missing AoN URLs as JSON for manual lookup.
 * Usage: node scripts/dump-missing.mjs
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const missing = items.filter((i) => !i.aonUrl);
for (const i of missing) {
  console.log(`${i.name} [${i.type}] -- ${i.source}`);
}
console.error(`\nTotal: ${missing.length}`);
