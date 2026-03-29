/**
 * Queries the AoN Elasticsearch API for all items missing AoN URLs,
 * trying to find matches, and outputs a suggested overrides JSON.
 *
 * Usage: node scripts/fetch-missing-aon-urls.mjs > /tmp/found-urls.json
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const missing = items.filter((i) => !i.aonUrl);
console.error(`Looking up ${missing.length} missing items on AoN...`);

const AON_ES = "https://elasticsearch.aonprd.com/aon/_search";

async function searchAon(name) {
  const url = `${AON_ES}?q=${encodeURIComponent(`"${name}"`)}&_source=name,url,category&size=3`;
  const res = await fetch(url);
  const data = await res.json();
  return data.hits?.hits ?? [];
}

/** Normalize a name for comparison */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

const found = {};
const notFound = [];

// Process in batches to avoid hammering the server
const BATCH = 5;
for (let i = 0; i < missing.length; i += BATCH) {
  const batch = missing.slice(i, i + BATCH);
  await Promise.all(
    batch.map(async (item) => {
      const hits = await searchAon(item.name);
      if (hits.length === 0) {
        // Try without parentheticals
        const stripped = item.name.replace(/\s*\([^)]*\)/g, "").trim();
        if (stripped !== item.name) {
          const hits2 = await searchAon(stripped);
          if (hits2.length > 0) {
            const top = hits2[0]._source;
            if (
              norm(top.name) === norm(item.name) ||
              norm(top.name) === norm(stripped)
            ) {
              found[item.name] = top.url;
              return;
            }
          }
        }
        notFound.push(item.name);
        return;
      }
      const top = hits[0]._source;
      // Accept if normalized names match
      if (norm(top.name) === norm(item.name)) {
        found[item.name] = top.url;
      } else {
        notFound.push(`${item.name} (closest: ${top.name})`);
      }
    }),
  );

  process.stderr.write(`\r${i + batch.length}/${missing.length}...`);
  // Small delay to be polite
  await new Promise((r) => setTimeout(r, 50));
}

process.stderr.write("\n");
console.error(
  `Found: ${Object.keys(found).length}, Not found: ${notFound.length}`,
);
console.error("\nNot found:");
for (const n of notFound.slice(0, 30)) console.error(" ", n);

// Write found overrides
writeFileSync("/tmp/aon-found.json", JSON.stringify(found, null, 2));
console.error("\nWrote /tmp/aon-found.json");
