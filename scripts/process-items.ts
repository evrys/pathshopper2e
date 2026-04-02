/**
 * Processes raw AoN item data (data/raw-items.json) into the
 * final data/items.json used by the app.
 *
 * This includes:
 * - Extracting relevant fields from the AoN Elasticsearch format
 * - Converting AoN custom markdown into HTML descriptions
 * - Filtering out unpriced items
 * - Sorting by level then name
 *
 * Usage: pnpm process-data
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { JsonItem, Price } from "../src/types.ts";

const RAW_INPUT = "data/raw-items.json";
const OUTPUT = "data/items.json";
const PUBLIC_OUTPUT = "public/data/items.json";

// ── AoN raw item shape ──────────────────────────────────────────────

interface AonItem {
  id: string;
  name: string;
  level: number;
  /** Price in copper pieces (e.g. 2400000 = 24,000 gp) */
  price?: number;
  price_raw?: string;
  bulk: number;
  bulk_raw?: string;
  trait_raw?: string[];
  rarity: string;
  usage?: string;
  primary_source: string;
  primary_source_category?: string;
  item_category?: string;
  item_subcategory?: string;
  url: string;
  /** If present, this is a legacy item that has been remastered */
  remaster_id?: string[];
  markdown: string;
  /** AoN category: equipment, weapon, armor, shield */
  category: string;
}

// ── Price parsing ───────────────────────────────────────────────────

/** Parse AoN price (in copper) into gp/sp/cp. */
function parsePrice(priceInCopper: number | undefined): Price {
  if (priceInCopper == null || priceInCopper <= 0) return {};

  const price: Price = {};
  let remaining = priceInCopper;

  const gp = Math.floor(remaining / 100);
  if (gp > 0) {
    price.gp = gp;
    remaining -= gp * 100;
  }

  const sp = Math.floor(remaining / 10);
  if (sp > 0) {
    price.sp = sp;
    remaining -= sp * 10;
  }

  if (remaining > 0) {
    price.cp = remaining;
  }

  return price;
}

// ── Type mapping ────────────────────────────────────────────────────

/** Map AoN category + item_category to the app's type field. */
function mapType(item: AonItem): string {
  if (item.category === "weapon") return "weapon";
  if (item.category === "armor") return "armor";
  if (item.category === "shield") return "shield";

  // equipment category — use item_category for finer distinction
  const ic = item.item_category ?? "";
  if (ic === "Consumables") return "consumable";
  if (ic === "Adventuring Gear") return "equipment";
  if (ic === "Worn Items") return "equipment";
  if (ic === "Held Items") return "equipment";
  if (ic === "Materials") return "equipment";
  if (ic === "Runes") return "equipment";
  if (ic === "Assistive Items") return "equipment";
  if (ic === "Staves") return "equipment";
  if (ic === "Contracts") return "equipment";
  if (ic === "Grimoires") return "equipment";
  if (ic === "Tattoos") return "equipment";
  if (ic === "Spellhearts") return "equipment";
  if (ic === "Structures") return "equipment";
  if (ic === "Customizations") return "equipment";
  if (ic === "Services") return "equipment";

  // Fallback
  return "equipment";
}

// ── Trait normalization ─────────────────────────────────────────────

/** Normalize AoN trait names to kebab-case slugs matching the app format. */
function normalizeTrait(trait: string): string {
  return trait.toLowerCase().replace(/\s+/g, "-");
}

/** Traits that are rarity indicators, not real traits. */
const RARITY_TRAITS = new Set(["common", "uncommon", "rare", "unique"]);

// ── AoN markdown → HTML conversion ─────────────────────────────────

/** Convert AoN custom markdown into sanitized HTML for display. */
function convertAonMarkdown(markdown: string): string {
  // The description body comes after the first "---" separator
  const parts = markdown.split(/\r?\n---\r?\n/);
  // Take everything after the first separator (the header/meta is before it)
  const body = parts.length > 1 ? parts.slice(1).join("\n---\n") : markdown;

  return aonToHtml(body);
}

/** Convert AoN-flavored markdown to HTML. */
function aonToHtml(text: string): string {
  let html = text;

  // Remove <title> blocks (sub-variant headers within the body)
  html = html.replace(
    /<title[^>]*>([\s\S]*?)<\/title>/g,
    (_match, inner: string) => {
      // Extract the text content, convert to an h2/h3
      const linkMatch = inner.match(/\[([^\]]+)\]\([^)]+\)/);
      const titleText = linkMatch ? linkMatch[1] : inner.trim();
      return titleText ? `<h3>${titleText}</h3>` : "";
    },
  );

  // Remove layout XML tags: <column>, <row>, <additional-info>, <summary>, <document>
  html = html.replace(
    /<\/?(column|row|additional-info|summary|document)\b[^>]*\/?>/g,
    "",
  );

  // Convert <traits> blocks — remove them from the description body
  // (traits are already in the structured data)
  html = html.replace(/<traits>[\s\S]*?<\/traits>/g, "");

  // Convert <actions> to text symbols
  html = html.replace(
    /<actions\s+string="([^"]*)"[^>]*\/>/g,
    (_m, s: string) => {
      const map: Record<string, string> = {
        "Single Action": "◆",
        "Two Actions": "◆◆",
        "Three Actions": "◆◆◆",
        "Free Action": "◇",
        Reaction: "↺",
      };
      return map[s] ?? s;
    },
  );

  // Convert markdown links [text](url) to HTML anchors
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, linkText: string, url: string) => {
      const fullUrl = url.startsWith("/") ? `https://2e.aonprd.com${url}` : url;
      return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    },
  );

  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Convert _italic_ (but not __double underscores__)
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<em>$1</em>");

  // Convert markdown horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Convert \n\n to paragraph breaks
  html = html.replace(/\r?\n\r?\n/g, "</p><p>");

  // Convert remaining \n to <br />
  html = html.replace(/\r?\n/g, "<br />");

  // Wrap in <p> tags
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/g, "");

  // Clean up whitespace
  html = html.replace(/\s+/g, " ").trim();

  return html;
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const rawItems = JSON.parse(readFileSync(RAW_INPUT, "utf-8")) as AonItem[];
  console.log(`Read ${rawItems.length} raw items from ${RAW_INPUT}.`);

  // Extract and convert each item
  const items: JsonItem[] = [];

  for (const raw of rawItems) {
    const price = parsePrice(raw.price);
    const traits = (raw.trait_raw ?? [])
      .map(normalizeTrait)
      .filter((t) => !RARITY_TRAITS.has(t));

    const item: JsonItem = {
      id: raw.id,
      name: raw.name,
      type: mapType(raw),
      level: raw.level ?? 0,
      price,
      category: raw.item_subcategory ?? raw.item_category ?? "",
      traits,
      rarity: raw.rarity ?? "common",
      bulk: raw.bulk ?? 0,
      usage: raw.usage ?? "",
      source: raw.primary_source ?? "",
      remaster: !raw.remaster_id || raw.remaster_id.length === 0,
      description: convertAonMarkdown(raw.markdown ?? ""),
      aonUrl: raw.url,
    };

    items.push(item);
  }

  console.log(`Extracted ${items.length} items.`);

  // Filter out items with no price
  const priced = items.filter(
    (item) =>
      item.price.gp !== undefined ||
      item.price.sp !== undefined ||
      item.price.cp !== undefined,
  );
  console.log(
    `Filtered out ${items.length - priced.length} items with no price (${priced.length} remaining).`,
  );

  // Sort by level, then name
  priced.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  mkdirSync("data", { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(priced));

  mkdirSync("public/data", { recursive: true });
  writeFileSync(PUBLIC_OUTPUT, JSON.stringify(priced));

  console.log(`Wrote ${priced.length} items to ${OUTPUT} and ${PUBLIC_OUTPUT}`);
}

main();
