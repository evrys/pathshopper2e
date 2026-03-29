/**
 * Fetches trait URLs from the Archives of Nethys Elasticsearch API
 * and builds a static mapping file for use in the frontend.
 *
 * Usage: npx tsx scripts/fetch-trait-urls.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

const AON_ES = "https://elasticsearch.aonprd.com/aon/_search";

interface EsHit {
  _source: { name: string; url: string };
}

interface EsResponse {
  hits: { total: { value: number }; hits: EsHit[] };
}

/** Fetch all traits from AoN elasticsearch in batches. */
async function fetchAllTraits(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const size = 500;

  while (true) {
    const url = `${AON_ES}?q=type:trait&size=${size}&from=${from}&_source=name,url&sort=name.keyword:asc`;
    const res = await fetch(url);
    const data = (await res.json()) as EsResponse;
    const hits = data.hits.hits;
    if (hits.length === 0) break;

    for (const hit of hits) {
      const name = hit._source.name.toLowerCase().replace(/ /g, "-");
      // Keep the first (non-legacy) URL for each trait name
      if (!map.has(name)) {
        map.set(name, hit._source.url);
      }
    }

    from += size;
    if (from >= data.hits.total.value) break;
  }

  return map;
}

/** Extract the base trait from a parameterized trait slug.
 *  e.g. "deadly-d10" → "deadly", "thrown-20" → "thrown",
 *       "fatal-aim-d12" → "fatal-aim", "attached-to-shield" → "attached",
 *       "versatile-b" → "versatile", "deflecting-slashing" → "deflecting"
 */
function baseTraitCandidates(trait: string): string[] {
  const candidates: string[] = [];
  // Strip trailing dice (d4, d6, d8, d10, d12) or numbers
  const noDice = trait.replace(/-d\d+$/, "").replace(/-\d+$/, "");
  if (noDice !== trait) candidates.push(noDice);

  // Strip "-to-..." suffix
  const noTo = trait.replace(/-to-.+$/, "");
  if (noTo !== trait) candidates.push(noTo);

  // Strip trailing number without hyphen: "additive0" → "additive"
  const noSuffix = trait.replace(/\d+$/, "");
  if (noSuffix !== trait && noSuffix.length > 0) candidates.push(noSuffix);

  // Strip last hyphenated segment progressively
  const parts = trait.split("-");
  for (let i = parts.length - 1; i >= 1; i--) {
    candidates.push(parts.slice(0, i).join("-"));
  }

  return candidates;
}

async function main() {
  // Load unique traits from items.json
  const items = JSON.parse(readFileSync("data/items.json", "utf-8"));
  const itemTraits = [
    ...new Set<string>(items.flatMap((i: { traits: string[] }) => i.traits)),
  ].sort();

  console.log(`Found ${itemTraits.length} unique traits in items.json`);

  // Fetch all trait URLs from AoN
  const aonTraits = await fetchAllTraits();
  console.log(`Fetched ${aonTraits.size} unique traits from AoN`);

  // Build the mapping: item trait slug → AoN URL path
  const traitUrls: Record<string, string> = {};
  const missing: string[] = [];

  // Also strip "additive" + number → "additive"
  for (const trait of itemTraits) {
    // Try exact match first
    if (aonTraits.has(trait)) {
      traitUrls[trait] = aonTraits.get(trait) as string;
      continue;
    }

    // Try progressively shorter base names
    const candidates = baseTraitCandidates(trait);
    const match = candidates.find((c) => aonTraits.has(c));
    if (match) {
      traitUrls[trait] = aonTraits.get(match) as string;
      continue;
    }

    missing.push(trait);
  }

  if (missing.length > 0) {
    console.log(`\nMissing ${missing.length} traits:`);
    for (const t of missing) {
      console.log(`  ${t}`);
    }
  }

  const matched = Object.keys(traitUrls).length;
  console.log(
    `\nMatched ${matched}/${itemTraits.length} traits (${missing.length} missing)`,
  );

  writeFileSync(
    "public/data/trait-urls.json",
    `${JSON.stringify(traitUrls, null, 2)}\n`,
  );
  console.log("Wrote public/data/trait-urls.json");
}

main();
