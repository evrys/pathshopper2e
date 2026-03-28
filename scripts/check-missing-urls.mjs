import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const csv = readFileSync("./data/aon-all-equipment.csv", "utf-8");
const lines = csv.split("\n");
const csvNames = new Map(); // name -> url

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const name = line.startsWith('"')
    ? line.slice(1, line.indexOf('"', 1))
    : line.split(",")[0];
  const url = line.split(",").at(-1);
  if (name && url && url.startsWith("/") && !csvNames.has(name)) {
    csvNames.set(name, url);
  }
}

const missing = items.filter((i) => !i.aonUrl);
console.log(`Total missing: ${missing.length}`);

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "") // remove parentheticals like "(10 feet)"
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

const csvNormMap = new Map();
for (const [name, url] of csvNames) {
  const norm = normalize(name);
  if (!csvNormMap.has(norm)) csvNormMap.set(norm, { name, url });
}

let found = 0;
const examples = [];
const stillMissing = [];
for (const item of missing) {
  const norm = normalize(item.name);
  const match = csvNormMap.get(norm);
  if (match) {
    found++;
    if (examples.length < 20)
      examples.push(`"${item.name}" -> "${match.name}"`);
  } else {
    stillMissing.push(item);
  }
}

console.log(
  `\nNormalization would match ${found}/${missing.length} more items`,
);
console.log("Examples:");
for (const e of examples) console.log(" ", e);

// Group still-missing by source book
const bySource = {};
for (const item of stillMissing) {
  bySource[item.source] = bySource[item.source] || [];
  bySource[item.source].push(item);
}
const sorted = Object.entries(bySource).sort(
  (a, b) => b[1].length - a[1].length,
);
console.log(`\nStill missing after normalization: ${stillMissing.length}`);
console.log("By source book:");
for (const [source, its] of sorted.slice(0, 15)) {
  console.log(`\n  [${its.length}] ${source}`);
  for (const i of its.slice(0, 5)) console.log(`    ${i.name} [${i.type}]`);
  if (its.length > 5) console.log(`    ... and ${its.length - 5} more`);
}
