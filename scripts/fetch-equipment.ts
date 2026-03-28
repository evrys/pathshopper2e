/**
 * Fetches PF2e equipment data from the Foundry VTT pf2e system repo
 * and extracts it into a single data/items.json for the app.
 *
 * Uses the GitHub API to download packs/equipment/*.json from
 * https://github.com/foundryvtt/pf2e (master branch).
 *
 * Usage: pnpm fetch-data
 */

import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Item, Price } from "../src/types.ts";

const REPO = "https://github.com/foundryvtt/pf2e.git";
const BRANCH = "master";
const SPARSE_PATH = "packs/equipment";
const CLONE_DIR = "node_modules/.cache/pf2e-data";
const OUTPUT = "data/items.json";

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

function processFiles(): Item[] {
  const equipDir = join(CLONE_DIR, SPARSE_PATH);
  const files = readdirSync(equipDir).filter((f) => f.endsWith(".json"));
  console.log(`Processing ${files.length} equipment files...`);

  const items: Item[] = [];

  for (const file of files) {
    try {
      const raw = JSON.parse(
        readFileSync(join(equipDir, file), "utf-8"),
      ) as FoundryItem;
      items.push(extractItem(raw));
    } catch (err) {
      console.warn(`Skipping ${file}: ${err}`);
    }
  }

  // Sort by level, then name
  items.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return items;
}

function main() {
  cloneEquipmentPack();
  const items = processFiles();

  mkdirSync("data", { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(items));
  console.log(`Wrote ${items.length} items to ${OUTPUT}`);

  // Clean up the clone
  rmSync(CLONE_DIR, { recursive: true });
  console.log("Cleaned up cache.");
}

main();
