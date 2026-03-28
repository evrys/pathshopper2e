/**
 * Attempts to resolve missing AoN URLs for items by searching their description
 * text against the AoN Elasticsearch API.
 *
 * For each item without an aonUrl, extracts a clean plain-text snippet from its
 * description, searches the AoN index restricted to equipment category, and if
 * exactly one hit is found, records the URL.
 *
 * Outputs a JSON object of { itemName: url } ready to paste into aon-url-overrides.json.
 *
 * Usage: node scripts/fetch-missing-aon-urls-pass3.mjs
 */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const SEARCH_URL = "https://elasticsearch.aonprd.com/aon/_search";
const DELAY_MS = 300; // be polite

/** Strip HTML tags and Foundry @UUID / [[...]] syntax, return plain text */
function extractPlainText(html) {
  return html
    .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1") // @UUID[...]{label} → label
    .replace(/@UUID\[[^\]]*\]/g, "") // bare @UUID[...] → nothing
    .replace(/\[\[.*?\]\]/g, "") // [[/r ...]] → nothing
    .replace(/<[^>]+>/g, " ") // HTML tags → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Pick a distinctive ~60-char snippet from plain text, avoiding the very start */
function pickSnippet(text) {
  // Skip any leading boilerplate-ish short words, take from ~20 chars in
  const start = Math.min(20, Math.floor(text.length / 4));
  return text.slice(start, start + 60).trim();
}

async function searchAon(snippet) {
  const body = {
    query: {
      bool: {
        must: [{ match_phrase: { text: snippet } }],
        filter: [{ term: { category: "equipment" } }],
      },
    },
    _source: ["name", "url"],
    size: 5,
  };

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.hits.hits.map((h) => ({
    name: h._source.name,
    url: h._source.url,
  }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const missing = items.filter(
  (i) => !i.aonUrl && i.source !== "Pathfinder Blog: April Fools",
);

console.log(`Searching AoN for ${missing.length} items...\n`);

const found = {};
const ambiguous = [];
const notFound = [];

for (const item of missing) {
  const plain = extractPlainText(item.description);
  if (plain.length < 30) {
    notFound.push(`${item.name} (description too short)`);
    continue;
  }

  const snippet = pickSnippet(plain);

  let hits;
  try {
    hits = await searchAon(snippet);
  } catch (e) {
    notFound.push(`${item.name} (error: ${e.message})`);
    continue;
  }

  if (hits.length === 1) {
    console.log(`✓ ${item.name} → ${hits[0].url}`);
    found[item.name] = hits[0].url;
  } else if (hits.length === 0) {
    // Try a shorter snippet from a different position
    const snippet2 = plain.slice(0, 50).trim();
    const hits2 = await searchAon(snippet2);
    if (hits2.length === 1) {
      console.log(`✓ ${item.name} → ${hits2[0].url} (fallback snippet)`);
      found[item.name] = hits2[0].url;
    } else {
      notFound.push(`${item.name} (no hits)`);
      console.log(`✗ ${item.name} — no hits`);
    }
  } else {
    ambiguous.push(`${item.name}: ${hits.map((h) => h.url).join(", ")}`);
    console.log(
      `? ${item.name} — ${hits.length} hits: ${hits.map((h) => h.name).join(", ")}`,
    );
  }

  await sleep(DELAY_MS);
}

console.log(`\n=== Results ===`);
console.log(`Found: ${Object.keys(found).length}`);
console.log(`Ambiguous: ${ambiguous.length}`);
console.log(`Not found: ${notFound.length}`);

if (ambiguous.length) {
  console.log(`\nAmbiguous:`);
  for (const a of ambiguous) console.log(`  ${a}`);
}
if (notFound.length) {
  console.log(`\nNot found:`);
  for (const n of notFound) console.log(`  ${n}`);
}

writeFileSync("data/aon-url-pass3.json", JSON.stringify(found, null, 2));
console.log(
  `\nWrote ${Object.keys(found).length} URLs to data/aon-url-pass3.json`,
);
