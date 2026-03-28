/**
 * Scan all item descriptions for unresolved Foundry VTT syntax after sanitization.
 * Reports any items where @-references, [[/r rolls]], or {display} overrides leak through.
 *
 * Usage: npx tsx scripts/scan-descriptions.ts
 */

import { readFileSync } from "node:fs";
import { sanitizeHtml } from "../src/lib/html.ts";
import type { Item } from "../src/types.ts";

const items = JSON.parse(readFileSync("data/items.json", "utf-8")) as Item[];

/** Patterns that indicate un-resolved Foundry syntax in sanitized output. */
const LEAK_PATTERNS: [RegExp, string][] = [
  [/@UUID\[/, "unresolved @UUID"],
  [/@Check\[/, "unresolved @Check"],
  [/@Damage\[/, "unresolved @Damage"],
  [/@Template\[/, "unresolved @Template"],
  [/@Embed\[/, "unresolved @Embed"],
  [/\[\[\/r\s/, "unresolved [[/r roll]]"],
  [/<span\b/, "unstripped <span>"],
];

let issues = 0;

for (const item of items) {
  if (!item.description) continue;
  const result = sanitizeHtml(item.description);

  for (const [pattern, label] of LEAK_PATTERNS) {
    const m = result.match(pattern);
    if (m) {
      issues++;
      const idx = m.index ?? 0;
      const context = result.substring(Math.max(0, idx - 30), idx + 80);
      console.log(`[${label}] ${item.name}:`);
      console.log(`  ...${context}...`);
      console.log();
      break;
    }
  }
}

if (issues === 0) {
  console.log("✓ No unresolved Foundry syntax found in any item description.");
} else {
  console.log(`Found ${issues} items with unresolved Foundry syntax.`);
  process.exit(1);
}
