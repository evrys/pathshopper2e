/**
 * Fetches all PF2e item, trait, and source data from the Archives of Nethys
 * Elasticsearch API and writes raw JSON files for further processing.
 *
 * Outputs:
 * - data/raw-items.json    — Equipment, weapons, armor, shields
 * - data/raw-traits.json   — All trait definitions
 * - data/raw-sources.json  — All sourcebook metadata
 *
 * Usage: pnpm fetch-data
 */

import { mkdirSync, writeFileSync } from "node:fs";

const AON_ES = "https://elasticsearch.aonprd.com/aon/_search";

interface EsHit {
  _id: string;
  _source: Record<string, unknown>;
}

interface EsResponse {
  hits: { total: { value: number }; hits: EsHit[] };
}

/** Fetch all documents matching a query, paginating automatically. */
async function fetchAll(
  query: string,
  sourceFields: string,
  label: string,
): Promise<Record<string, unknown>[]> {
  const allDocs: Record<string, unknown>[] = [];
  let from = 0;
  const size = 500;

  // First request to get total count
  const countUrl = `${AON_ES}?q=${encodeURIComponent(query)}&size=0`;
  const countRes = await fetch(countUrl);
  const countData = (await countRes.json()) as EsResponse;
  const total = countData.hits.total.value;
  console.log(`  ${label}: ${total} documents`);

  while (from < total) {
    const url = `${AON_ES}?q=${encodeURIComponent(query)}&size=${size}&from=${from}&_source=${sourceFields}&sort=_doc`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `AoN API error: ${res.status} ${res.statusText} (${label}, from=${from})`,
      );
    }
    const data = (await res.json()) as EsResponse;
    const hits = data.hits.hits;
    if (hits.length === 0) break;
    for (const hit of hits) allDocs.push(hit._source);
    from += size;
  }

  return allDocs;
}

/** Fields we need from each item document. */
const ITEM_FIELDS = [
  "id",
  "name",
  "level",
  "price",
  "price_raw",
  "bulk",
  "bulk_raw",
  "trait_raw",
  "rarity",
  "usage",
  "primary_source",
  "primary_source_category",
  "item_category",
  "item_subcategory",
  "url",
  "remaster_id",
  "markdown",
  "category",
].join(",");

/** AoN categories that represent purchasable items. */
const ITEM_CATEGORIES = ["equipment", "weapon", "armor", "shield"] as const;

const TRAIT_FIELDS = "id,name,url,summary,trait_group";
const SOURCE_FIELDS =
  "id,name,url,primary_source_category,primary_source_group,release_date";

async function main() {
  mkdirSync("data", { recursive: true });

  // ── Items ───────────────────────────────────────────────────────────
  console.log("Fetching items from Archives of Nethys...");
  const allItems: Record<string, unknown>[] = [];
  for (const category of ITEM_CATEGORIES) {
    const docs = await fetchAll(
      `category:${category} AND type:Item`,
      ITEM_FIELDS,
      category,
    );
    allItems.push(...docs);
  }
  console.log(`  Total: ${allItems.length} items\n`);
  writeFileSync("data/raw-items.json", JSON.stringify(allItems));
  console.log("Wrote data/raw-items.json");

  // ── Traits ──────────────────────────────────────────────────────────
  console.log("\nFetching traits...");
  const traits = await fetchAll("type:Trait", TRAIT_FIELDS, "traits");
  writeFileSync("data/raw-traits.json", JSON.stringify(traits, null, 2));
  console.log(`Wrote data/raw-traits.json (${traits.length} traits)`);

  // ── Sources ─────────────────────────────────────────────────────────
  console.log("\nFetching sources...");
  const sources = await fetchAll("type:Source", SOURCE_FIELDS, "sources");
  writeFileSync("data/raw-sources.json", JSON.stringify(sources, null, 2));
  console.log(`Wrote data/raw-sources.json (${sources.length} sources)`);
}

main();
