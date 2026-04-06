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

import { marked } from "marked";
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

/** Configure marked to rewrite relative AoN links to absolute URLs. */
const renderer = new marked.Renderer();
renderer.link = function ({ href, tokens, text }) {
  const fullUrl = href.startsWith("/") ? `https://2e.aonprd.com${href}` : href;
  const rendered = tokens ? this.parser.parseInline(tokens) : text;
  return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${rendered}</a>`;
};
marked.use({ renderer, async: false });

/** Action symbol map for AoN <actions> tags. */
const ACTION_SYMBOLS: Record<string, string> = {
  "Single Action": "◆",
  "Two Actions": "◆◆",
  "Three Actions": "◆◆◆",
  "Free Action": "◇",
  Reaction: "↺",
};

/** Strip AoN custom XML from markdown, leaving clean markdown for `marked`. */
function stripAonXml(md: string): string {
  let text = md;

  // Fix unmatched italic underscores in link text: [_text](/url) → [_text_](/url)
  text = text.replace(/\[_([^_\]]+)\]\(/g, "[_$1_](");

  // Remove "Critical Specialization Effects" and "Specific Magic Weapons"
  // sections (everything from their <title> to the next <title> or end).
  // We provide our own crit spec via buildCritSpec(), and re-append
  // Specific Magic Weapons at the end via extractSpecificMagicWeapons().
  text = text.replace(
    /<title[^>]*>(?:Critical Specialization Effects|Specific Magic Weapons)<\/title>[\s\S]*?(?=<title|$)/g,
    "",
  );

  // Convert markdown inside HTML elements so marked doesn't skip it
  text = text.replace(
    /<(td|th|li)\b[^>]*>([\s\S]*?)<\/\1>/g,
    (_match, tag: string, inner: string) => {
      const rendered = marked.parseInline(inner) as string;
      return `<${tag}>${rendered}</${tag}>`;
    },
  );

  // Convert <title> blocks to markdown headings
  text = text.replace(
    /<title[^>]*>([\s\S]*?)<\/title>/g,
    (_match, inner: string) => {
      const content = inner.trim();
      // Extract link text or use raw content
      const linkMatch = content.match(/\[([^\]]+)\]\([^)]+\)/);
      const heading = linkMatch ? linkMatch[1] : content;
      return heading ? `### ${heading}\n\n` : "";
    },
  );

  // Remove <traits> blocks (already in structured data)
  text = text.replace(/<traits>[\s\S]*?<\/traits>/g, "");

  // Remove layout XML tags
  text = text.replace(
    /<\/?(column|row|additional-info|summary|document)\b[^>]*\/?>/g,
    "",
  );

  // Convert <actions> to text symbols
  text = text.replace(
    /<actions\s+string="([^"]*)"[^>]*\/>/g,
    (_m, s: string) => ACTION_SYMBOLS[s] ?? s,
  );

  return text;
}

/**
 * Extract the plain text name from a `<title>` block, which may contain
 * markdown links like `[Name](/url)`.
 */
function titleName(titleBlock: string): string {
  const inner = titleBlock.replace(/<\/?title[^>]*>/g, "").trim();
  const linkMatch = inner.match(/\[([^\]]+)\]\([^)]+\)/);
  return (linkMatch ? linkMatch[1] : inner).replace(/\s+/g, " ");
}

/**
 * Given the markdown body (after the header `---`), extract only the section
 * that belongs to `itemName`.
 *
 * AoN multi-variant items share a common intro followed by `<title>` blocks,
 * one per variant.  Each variant's block is followed by metadata (traits,
 * source, price, bulk) then a `---` separator, then the variant-specific
 * description.  We keep the shared intro + only the matching variant's
 * description.
 */
function extractVariantBody(body: string, itemName: string): string {
  // Split into alternating [text, title, text, title, text, ...]
  const sections = body.split(/(<title[^>]*>[\s\S]*?<\/title>)/);

  // If there are fewer than 2 title blocks, there's nothing to filter
  const titleCount = sections.filter((_, i) => i % 2 === 1).length;
  if (titleCount < 2) return body;

  const intro = sections[0];
  const nameNorm = itemName.replace(/\s+/g, " ").trim();

  // Walk the title/text pairs (title at odd indices, text at even)
  for (let i = 1; i < sections.length; i += 2) {
    const name = titleName(sections[i]);
    if (name !== nameNorm) continue;

    // The text section that follows this title
    const variantMeta = sections[i + 1] ?? "";

    // The variant description comes after the last "---" in its text block
    const descParts = variantMeta.split(/\r?\n---\r?\n/);
    const variantDesc =
      descParts.length > 1 ? descParts.slice(1).join("\n---\n") : "";

    // Keep the title block as a heading only if there is variant-specific text
    if (variantDesc.trim()) {
      return `${intro}\n${sections[i]}\n${variantDesc}`;
    }
    return intro;
  }

  // No matching title found — return everything (parent / base item)
  return body;
}

/** Convert AoN custom markdown into HTML for display. */
function convertAonMarkdown(markdown: string, itemName: string): string {
  // The description body comes after the first "---" separator
  const parts = markdown.split(/\r?\n---\r?\n/);
  const body = parts.length > 1 ? parts.slice(1).join("\n---\n") : markdown;

  const filtered = extractVariantBody(body, itemName);
  const cleaned = stripAonXml(filtered);
  let html = marked.parse(cleaned) as string;

  // Some markdown survives when adjacent to HTML blocks; convert it inline
  html = html.replace(
    /\[_?([^\]]+?)_?\]\(([^)]+)\)/g,
    (_m, text: string, href: string) => {
      const fullUrl = href.startsWith("/")
        ? `https://2e.aonprd.com${href}`
        : href;
      const inner = marked.parseInline(text) as string;
      return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    },
  );
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Clean up whitespace
  return html.replace(/\s+/g, " ").trim();
}

// ── Source ID extraction ────────────────────────────────────────────

/** Extract the AoN source ID from the markdown's **Source** link. */
function extractSourceId(markdown: string): string {
  const match = markdown.match(
    /\*\*Source\*\*\s*\[[^\]]+\]\(\/Sources\.aspx\?ID=(\d+)\)/,
  );
  return match ? match[1] : "";
}

// ── ID shortening ───────────────────────────────────────────────────

const CATEGORY_PREFIX: Record<string, string> = {
  equipment: "e",
  weapon: "w",
  armor: "a",
  shield: "s",
};

/** Shorten an AoN id like "equipment-1405-1291" → "e1405.1291". */
function shortenId(aonId: string): string {
  const dashIdx = aonId.indexOf("-");
  if (dashIdx === -1) return aonId;
  const category = aonId.slice(0, dashIdx);
  const rest = aonId.slice(dashIdx + 1);
  const prefix = CATEGORY_PREFIX[category] ?? `${category}-`;
  return `${prefix}${rest.replace(/-/g, ".")}`;
}

// ── Trait descriptions ──────────────────────────────────────────────

const TRAIT_DESCRIPTIONS_PATH = "public/data/trait-descriptions.json";

/** Load the trait slug → HTML description map. */
function loadTraitDescriptions(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(TRAIT_DESCRIPTIONS_PATH, "utf-8")) as Record<
      string,
      string
    >;
  } catch {
    console.warn("Could not load trait descriptions; skipping.");
    return {};
  }
}

/**
 * Look up a trait description by its normalized slug.
 *
 * Tries the exact key, then common normalizations:
 *   - strip `-ft.` / `-feet` suffixes  (`thrown-20-ft.` → `thrown-20`)
 *   - strip `1` prefix from die sizes  (`fatal-1d10`   → `fatal-d10`)
 */
function traitDescription(
  slug: string,
  descs: Record<string, string>,
): string | undefined {
  if (descs[slug]) return descs[slug];

  // Strip measurement suffixes
  const stripped = slug.replace(/-ft\.?$/, "").replace(/-feet$/, "");
  if (descs[stripped]) return descs[stripped];

  // Normalize "1d" → "d" in die sizes (e.g. fatal-1d10 → fatal-d10)
  const normDice = stripped.replace(/\b1(d\d+)/, "$1");
  if (descs[normDice]) return descs[normDice];

  return undefined;
}

/** Format a trait slug like "deadly-d10" into "Deadly D10". */
function formatTraitLabel(trait: string): string {
  return trait.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build an HTML section listing trait descriptions for the given traits. */
function buildTraitDescriptions(
  traits: string[],
  descs: Record<string, string>,
): string {
  const entries: string[] = [];
  for (const trait of traits) {
    const desc = traitDescription(trait, descs);
    if (!desc) continue;
    // Trait descriptions may contain raw markdown italic; convert inline
    const html = (marked.parseInline(desc) as string).replace(/\s+/g, " ");
    entries.push(`<p><strong>${formatTraitLabel(trait)}</strong> ${html}</p>`);
  }
  return entries.length > 0 ? `<hr />${entries.join("")}` : "";
}

// ── Critical specialization effects ─────────────────────────────────

/**
 * Critical specialization effect descriptions by weapon group.
 * Source: https://2e.aonprd.com/WeaponGroups.aspx (Player Core pg. 283)
 */
const CRIT_SPEC: Record<string, string> = {
  Axe: "Choose one creature adjacent to the initial target and within reach. If its AC is lower than your attack roll result for the critical hit, you deal damage to that creature equal to the result of the weapon damage die you rolled (including extra dice for its _striking_ rune, if any). This amount isn't doubled, and no bonuses or other additional dice apply to this damage.",
  Bomb: "Increase the radius of the bomb's splash damage (if any) to 10 feet.",
  Bow: "If the target of the critical hit is adjacent to a surface, it gets stuck to that surface by the missile. The target is immobilized and must spend an Interact action to attempt a DC 10 Athletics check to pull the missile free; it can't move from its space until it succeeds. The creature doesn't become stuck if it is incorporeal, is liquid, or could otherwise escape without effort.",
  Brawling:
    "The target must succeed at a Fortitude save against your class DC or be slowed 1 until the end of your next turn.",
  Club: "You knock the target away from you up to 10 feet (you choose the distance). This is forced movement.",
  Crossbow:
    "The target takes 1d8 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",
  Dart: "The target takes 1d6 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",
  Firearm:
    "The target must succeed at a Fortitude save against your class DC or be stunned 1.",
  Flail:
    "The target is knocked prone unless they succeed at a Reflex save against your class DC.",
  Hammer:
    "The target is knocked prone unless they succeed at a Fortitude save against your class DC.",
  Knife:
    "The target takes 1d6 persistent bleed damage. You gain an item bonus to this bleed damage equal to the weapon's item bonus to attack rolls.",
  Pick: "The weapon viciously pierces the target, who takes 2 additional damage per weapon damage die.",
  Polearm:
    "The target is moved 5 feet in a direction of your choice. This is forced movement.",
  Shield: "You knock the target back from you 5 feet. This is forced movement.",
  Sling:
    "The target must succeed at a Fortitude save against your class DC or be stunned 1.",
  Spear:
    "The weapon pierces the target, weakening its attacks. The target is clumsy 1 until the start of your next turn.",
  Sword:
    "The target is made off-balance by your attack, becoming off-guard until the start of your next turn.",
};

/** Extract the weapon group name from raw AoN markdown (e.g. "Sword"). */
function extractWeaponGroup(markdown: string): string | undefined {
  const match = markdown.match(/\*\*Group\*\*\s*\[([^\]]+)\]/);
  return match ? match[1] : undefined;
}

/** Build an HTML section for the weapon's critical specialization effect. */
function buildCritSpec(group: string): string {
  const desc = CRIT_SPEC[group];
  if (!desc) return "";
  const html = (marked.parseInline(desc) as string).replace(/\s+/g, " ");
  return `<hr /><p><strong>Critical Specialization</strong> (${group}) ${html}</p>`;
}

/**
 * Extract the "Specific Magic Weapons" list from raw AoN markdown and
 * convert it to an HTML section. Returns empty string if not present.
 */
function extractSpecificMagicWeapons(markdown: string): string {
  const match = markdown.match(
    /<title[^>]*>Specific Magic Weapons<\/title>\s*([\s\S]*?)(?=<title|$)/,
  );
  if (!match) return "";
  const body = match[1].trim();
  if (!body) return "";
  const html = marked.parse(body) as string;
  return `<hr /><p><strong>Specific Magic Weapons</strong></p>${html.replace(/\s+/g, " ").trim()}`;
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const rawItems = JSON.parse(readFileSync(RAW_INPUT, "utf-8")) as AonItem[];
  console.log(`Read ${rawItems.length} raw items from ${RAW_INPUT}.`);

  const traitDescs = loadTraitDescriptions();

  // ── Merge combination-weapon melee/ranged pairs ───────────────────
  // AoN lists combination weapons (e.g. Axe Musket) as two entries:
  //   weapon-213          → "Axe Musket (Ranged)"
  //   weapon-213--melee   → "Axe Musket (Melee)"
  // We merge them into a single item, combining traits from both modes.
  const rawById = new Map(rawItems.map((r) => [r.id, r]));
  const meleeIds = new Set<string>();

  for (const raw of rawItems) {
    if (!raw.id.endsWith("--melee")) continue;
    const baseId = raw.id.replace(/--melee$/, "");
    const base = rawById.get(baseId);
    if (!base) continue;

    meleeIds.add(raw.id);

    // Merge melee traits into the base and drop the "(Ranged)" suffix
    const meleeTraits = raw.trait_raw ?? [];
    const baseTraits = base.trait_raw ?? [];
    const combined = [...new Set([...baseTraits, ...meleeTraits])];
    base.trait_raw = combined;
    base.name = base.name.replace(/ \(Ranged\)$/, "");
  }

  const filteredRaw = rawItems.filter((r) => !meleeIds.has(r.id));
  console.log(`Merged ${meleeIds.size} combination-weapon melee entries.`);

  // Extract and convert each item
  const items: JsonItem[] = [];

  for (const raw of filteredRaw) {
    const price = parsePrice(raw.price);
    const traits = (raw.trait_raw ?? [])
      .map(normalizeTrait)
      .filter((t) => !RARITY_TRAITS.has(t));

    let description = convertAonMarkdown(raw.markdown ?? "", raw.name);

    // Append trait descriptions and crit spec for weapons
    if (raw.category === "weapon") {
      description += buildTraitDescriptions(traits, traitDescs);
      const group = extractWeaponGroup(raw.markdown ?? "");
      if (group) {
        description += buildCritSpec(group);
      }
      description += extractSpecificMagicWeapons(raw.markdown ?? "");
    }

    const item: JsonItem = {
      id: shortenId(raw.id),
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
      sourceId: extractSourceId(raw.markdown ?? ""),
      remaster: !raw.remaster_id || raw.remaster_id.length === 0,
      description,
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
