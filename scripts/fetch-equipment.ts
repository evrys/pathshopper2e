/**
 * Fetches PF2e equipment data from the Foundry VTT pf2e system repo
 * and extracts it into a single data/items.json for the app.
 *
 * Uses the GitHub API to download packs/equipment/*.json from
 * https://github.com/foundryvtt/pf2e (master branch).
 *
 * Usage: pnpm fetch-data
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Item, Price } from "../src/types.ts";

const REPO = "https://github.com/foundryvtt/pf2e.git";
const BRANCH = "master";
const SPARSE_PATH = "packs/equipment";
const CLONE_DIR = "node_modules/.cache/pf2e-data";
const OUTPUT = "data/items.json";
const AON_CSV = "data/aon-all-equipment.csv";
const AON_OVERRIDES = "data/aon-url-overrides.json";

/**
 * Items that have been renamed in AoN but whose source data (Foundry) still
 * uses the old name. Map from old Foundry name → current AoN name.
 */
const NAME_CORRECTIONS: Record<string, string> = {
  "Wyrm on the Wing": "Wyrm's Wingspan",
  "Wyrm on the Wing (Greater)": "Wyrm's Wingspan (Greater)",
  "Wyrm on the Wing (Major)": "Wyrm's Wingspan (Major)",
  "Extendable Pincer": "Extendible Pincer",
  "Magazine with 5 Bolts": "Repeating Hand Crossbow Magazine",
  "Magazine with 6 Pellets": "Magazine (Air Repeater)",
  "Magazine with 8 Pellets": "Magazine (Long Air Repeater)",
  "Ghast Stiletto": "Ghoul Stiletto",
  "Wondrous Figurine, Stuffed Fox": "Wondrous Figurine (Stuffed Fox)",
  "Musket Staff of Void": "Musket Staff of the Void",
  "Dragonscale Staff": "Dragonscale Bo Staff",
  "Bloodhammer Reserve Select": "Bloodhammer Reserve (Select)",
};

/**
 * Items that exist in the Foundry source data but have no corresponding AoN
 * page (e.g. removed or replaced in a later printing). Excluded from output.
 */
const EXCLUDED_ITEMS = new Set([
  "Choker-Arm Mutagen (Lesser)",
  "Choker-Arm Mutagen (Moderate)",
  "Choker-Arm Mutagen (Greater)",
  "Choker-Arm Mutagen (Major)",
  "Cytillesh Toolkit",
  "Darkening Poison",
  "Formulated Sunlight",
  "Sling Darts",
  "Varisian Emblem (Avaria)",
  "Varisian Emblem (Avidais)",
  "Varisian Emblem (Carnasia)",
  "Varisian Emblem (Idolis)",
  "Varisian Emblem (Ragario)",
  "Varisian Emblem (Vangloris)",
  "Varisian Emblem (Voratalo)",
]);

/**
 * Normalize an item name for fuzzy matching against the AoN CSV.
 * Strips parentheticals, collapses hyphens/spaces, lowercases.
 */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "") // remove "(10 feet)", "(Melee)", "(PFS Guide)", etc.
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

/**
 * Parse the AoN CSV export and build a Map from item name to URL path.
 * The CSV has quoted fields so we need to handle commas inside quotes.
 * Also returns a normalized-name fallback map for fuzzy matching.
 */
function loadAonUrls(): {
  exact: Map<string, string>;
  normalized: Map<string, string>;
} {
  const csv = readFileSync(AON_CSV, "utf-8");
  const lines = csv.split("\n");
  // header: name,pfs,source,rarity,trait,item_category,item_subcategory,level,price,bulk,usage,url
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV row respecting quoted fields
    const fields = parseCsvRow(line);
    const name = fields[0];
    const url = fields[fields.length - 1]; // url is the last column

    if (name && url && url.startsWith("/")) {
      // First match wins — keeps the first (usually remastered) entry
      if (!exact.has(name)) {
        exact.set(name, url);
      }
      const norm = normalizeForMatch(name);
      if (!normalized.has(norm)) {
        normalized.set(norm, url);
      }
    }
  }

  console.log(`Loaded ${exact.size} AoN URLs from CSV.`);
  return { exact, normalized };
}

/** Simple CSV row parser that handles quoted fields with commas */
function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
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
  return fields;
}

function cloneEquipmentPack() {
  // Clean previous clone
  if (existsSync(CLONE_DIR)) {
    rmSync(CLONE_DIR, { recursive: true });
  }
  mkdirSync(CLONE_DIR, { recursive: true });

  console.log("Cloning equipment pack data (sparse checkout)...");

  // Use sparse checkout to only download packs/equipment
  execSync(
    [
      `git clone --no-checkout --depth 1 --filter=blob:none --branch ${BRANCH}`,
      `--sparse "${REPO}" "${CLONE_DIR}"`,
    ].join(" "),
    { stdio: "inherit" },
  );

  execSync(`git -C "${CLONE_DIR}" sparse-checkout set "${SPARSE_PATH}"`, {
    stdio: "inherit",
  });

  execSync(`git -C "${CLONE_DIR}" checkout`, { stdio: "inherit" });

  console.log("Clone complete.");
}

interface FoundryItem {
  _id: string;
  name: string;
  type: string;
  system: {
    level?: { value: number };
    price?: { value: Record<string, number> };
    category?: string;
    stackGroup?: string;
    traits?: { rarity?: string; value?: string[] };
    bulk?: { value: number };
    usage?: { value: string };
    publication?: { title?: string; remaster?: boolean };
    description?: { value: string };
  };
}

function extractItem(raw: FoundryItem): Item {
  const sys = raw.system;

  const price: Price = {};
  const rawPrice = sys.price?.value;
  if (rawPrice) {
    if (rawPrice.gp) price.gp = rawPrice.gp;
    if (rawPrice.sp) price.sp = rawPrice.sp;
    if (rawPrice.cp) price.cp = rawPrice.cp;
  }

  return {
    id: raw._id,
    name: raw.name,
    type: raw.type,
    level: sys.level?.value ?? 0,
    price,
    category: sys.category ?? "",
    traits: sys.traits?.value ?? [],
    rarity: sys.traits?.rarity ?? "common",
    bulk: sys.bulk?.value ?? 0,
    usage: sys.usage?.value ?? "",
    source: sys.publication?.title ?? "",
    remaster: sys.publication?.remaster ?? false,
    description: sys.description?.value ?? "",
  };
}

function processFiles(): {
  items: Item[];
  stackGroups: Map<string, string>;
} {
  const equipDir = join(CLONE_DIR, SPARSE_PATH);
  const files = readdirSync(equipDir).filter((f) => f.endsWith(".json"));
  console.log(`Processing ${files.length} equipment files...`);

  const items: Item[] = [];
  const stackGroups = new Map<string, string>();

  for (const file of files) {
    try {
      const raw = JSON.parse(
        readFileSync(join(equipDir, file), "utf-8"),
      ) as FoundryItem;
      const item = extractItem(raw);
      items.push(item);
      if (raw.system.stackGroup) {
        stackGroups.set(item.id, raw.system.stackGroup);
      }
    } catch (err) {
      console.warn(`Skipping ${file}: ${err}`);
    }
  }

  // Exclude items with no price (price object has no gp/sp/cp set)
  const priced = items.filter(
    (item) =>
      item.price.gp !== undefined ||
      item.price.sp !== undefined ||
      item.price.cp !== undefined,
  );
  console.log(
    `Filtered out ${items.length - priced.length} items with no price (${priced.length} remaining).`,
  );

  // Exclude items with no AoN presence
  const included = priced.filter((item) => !EXCLUDED_ITEMS.has(item.name));
  if (priced.length - included.length > 0) {
    console.log(
      `Excluded ${priced.length - included.length} items with no AoN page (${included.length} remaining).`,
    );
  }

  // Sort by level, then name
  included.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return { items: included, stackGroups };
}

/** AoN rules pages for treasure items that aren't individually listed. */
const AON_GEMS_URL = "/Rules.aspx?ID=3228";
const AON_ART_OBJECTS_URL = "/Rules.aspx?ID=3229";

function main() {
  cloneEquipmentPack();
  const { items, stackGroups } = processFiles();

  // Apply name corrections for items renamed in AoN since Foundry source data was published
  let nameCorrections = 0;
  for (const item of items) {
    const corrected = NAME_CORRECTIONS[item.name];
    if (corrected) {
      item.name = corrected;
      nameCorrections++;
    }
  }
  if (nameCorrections > 0) {
    console.log(`Applied ${nameCorrections} name corrections.`);
  }

  // Annotate items with AoN URLs — try exact name first, then normalized fallback
  const aonUrls = loadAonUrls();
  let matched = 0;
  let normalizedMatched = 0;
  for (const item of items) {
    const url = aonUrls.exact.get(item.name);
    if (url) {
      item.aonUrl = url;
      matched++;
    } else {
      const normUrl = aonUrls.normalized.get(normalizeForMatch(item.name));
      if (normUrl) {
        item.aonUrl = normUrl;
        normalizedMatched++;
      }
    }
  }
  console.log(
    `Matched ${matched} items exactly, ${normalizedMatched} via normalized name (${matched + normalizedMatched}/${items.length} total).`,
  );

  // Apply manual URL overrides for items not in the CSV
  const overrides = JSON.parse(readFileSync(AON_OVERRIDES, "utf-8")) as Record<
    string,
    string
  >;
  let overrideCount = 0;
  for (const item of items) {
    if (item.aonUrl) continue;
    const url = overrides[item.name];
    if (url) {
      item.aonUrl = url;
      overrideCount++;
    }
  }
  console.log(
    `Applied ${overrideCount} manual AoN URL overrides (${Object.keys(overrides).length} defined).`,
  );

  // Assign fallback URLs for treasure items (gems & art objects)
  let gemCount = 0;
  let artCount = 0;
  for (const item of items) {
    if (item.aonUrl || item.type !== "treasure") continue;
    const sg = stackGroups.get(item.id);
    if (sg === "gems") {
      item.aonUrl = AON_GEMS_URL;
      gemCount++;
    } else if (sg === "coins") {
      // Skip currency items
    } else {
      item.aonUrl = AON_ART_OBJECTS_URL;
      artCount++;
    }
  }
  if (gemCount + artCount > 0) {
    console.log(
      `Assigned fallback AoN URLs: ${gemCount} gems, ${artCount} art objects.`,
    );
  }

  mkdirSync("data", { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(items));
  console.log(`Wrote ${items.length} items to ${OUTPUT}`);

  // Clean up the clone
  rmSync(CLONE_DIR, { recursive: true });
  console.log("Cleaned up cache.");
}

main();
