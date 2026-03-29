/**
 * Fetches raw PF2e equipment data from the Foundry VTT pf2e system repo
 * and writes it to data/raw-items.json for further processing.
 *
 * Uses a sparse git checkout to download only packs/equipment/*.json from
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

const REPO = "https://github.com/foundryvtt/pf2e.git";
const BRANCH = "master";
const SPARSE_PATH = "packs/equipment";
const CLONE_DIR = "node_modules/.cache/pf2e-data";
const OUTPUT = "data/raw-items.json";

function cloneEquipmentPack() {
  if (existsSync(CLONE_DIR)) {
    rmSync(CLONE_DIR, { recursive: true });
  }
  mkdirSync(CLONE_DIR, { recursive: true });

  console.log("Cloning equipment pack data (sparse checkout)...");

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

function extractRawItems() {
  const equipDir = join(CLONE_DIR, SPARSE_PATH);
  const files = readdirSync(equipDir).filter((f) => f.endsWith(".json"));
  console.log(`Reading ${files.length} equipment files...`);

  const items: unknown[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(equipDir, file), "utf-8"));
      items.push(raw);
    } catch (err) {
      console.warn(`Skipping ${file}: ${err}`);
    }
  }

  return items;
}

function main() {
  cloneEquipmentPack();
  const items = extractRawItems();

  mkdirSync("data", { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(items));
  console.log(`Wrote ${items.length} raw items to ${OUTPUT}`);

  rmSync(CLONE_DIR, { recursive: true });
  console.log("Cleaned up cache.");
}

main();
