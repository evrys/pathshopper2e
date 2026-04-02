/**
 * Fetches all PF2e item data from the Archives of Nethys Elasticsearch API
 * and writes it to data/raw-items.json for further processing.
 *
 * Pulls equipment, weapons, armor, and shields with their full markdown
 * descriptions directly from AoN's public search index.
 *
 * Usage: pnpm fetch-data
 */

import { mkdirSync, writeFileSync } from "node:fs";

const AON_ES = "https://elasticsearch.aonprd.com/aon/_search";

/** Fields we need from each item document. */
const SOURCE_FIELDS = [
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

interface EsHit {
  _id: string;
  _source: Record<string, unknown>;
}

interface EsResponse {
  hits: { total: { value: number }; hits: EsHit[] };
}

/** Fetch all items for a given category, paginating with from/size. */
async function fetchCategory(category: string): Promise<EsHit[]> {
  const allHits: EsHit[] = [];
  let from = 0;
  const size = 500;

  // First request to get total count
  const countUrl = `${AON_ES}?q=category:${category}+AND+type:Item&size=0`;
  const countRes = await fetch(countUrl);
  const countData = (await countRes.json()) as EsResponse;
  const total = countData.hits.total.value;
  console.log(`  ${category}: ${total} items`);

  while (from < total) {
    const url = `${AON_ES}?q=category:${category}+AND+type:Item&size=${size}&from=${from}&_source=${SOURCE_FIELDS}&sort=_doc`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `AoN API error: ${res.status} ${res.statusText} (from=${from})`,
      );
    }
    const data = (await res.json()) as EsResponse;
    const hits = data.hits.hits;
    if (hits.length === 0) break;
    allHits.push(...hits);
    from += size;
  }

  return allHits;
}

async function main() {
  console.log("Fetching items from Archives of Nethys...");

  const allItems: Record<string, unknown>[] = [];

  for (const category of ITEM_CATEGORIES) {
    const hits = await fetchCategory(category);
    for (const hit of hits) {
      allItems.push(hit._source);
    }
  }

  console.log(`\nFetched ${allItems.length} total items.`);

  mkdirSync("data", { recursive: true });
  writeFileSync("data/raw-items.json", JSON.stringify(allItems));
  console.log("Wrote data/raw-items.json");
}

main();
