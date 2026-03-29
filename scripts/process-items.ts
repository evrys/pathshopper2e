/**
 * Processes raw Foundry equipment data (data/raw-items.json) into the
 * final data/items.json used by the app.
 *
 * This includes:
 * - Extracting relevant fields from the Foundry format
 * - Filtering out unpriced / excluded items
 * - Matching items to AoN URLs
 * - Annotating items with suggested classes based on proficiency rules
 *
 * Usage: pnpm process-data
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { JsonItem, Price } from "../src/types.ts";

const RAW_INPUT = "data/raw-items.json";
const OUTPUT = "data/items.json";
const AON_CSV = "data/aon-all-equipment.csv";
const AON_OVERRIDES = "data/aon-url-overrides.json";

// ── Name corrections ────────────────────────────────────────────────

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
  "Bloodhammer Reserve Black Label": "Bloodhammer Reserve (Black Label)",
  "Disrupting Oil": "Burial Oil",
  "Disrupting Oil (Greater)": "Burial Oil (Greater)",
  "Yellow Musk Poison": "Yellow Musk Vial",
  Cutlery: "Cutlery (Spoon Gun Ammo)",
  "Treat (Standard)": "Treats (Standard)",
  "Treat (Unique)": "Treats (Unique)",
  "Dragon Throat Scale": "Dragon Breath Scale",
  "Assassin Vine Wine": "Arbor Wine",
  "Aged Assassin Vine Wine": "Arbor Wine (Aged)",
  "Cordelia's Greater Construct Key": "Cordelia's Construct Key (Greater)",
  "Tyrant's Writs": "Tyrant's Writ",
  "Aether Marbles (Greater)": "Greater Aether Marbles",
  "Bloodhound Olfactory Stimulators": "Olfactory Stimulators (Bloodhound)",
  "Wand of Wearing Dance": "Wand of Wearying Dance",
  "Mantle of Amazing Health": "Mantle of the Amazing Health",
  "Cipher of Elemental Planes": "Cipher of the Elemental Planes",
};

// ── Excluded items ──────────────────────────────────────────────────

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
  "Splendid Pyschopomp Mask",
  "Splendid Skull Mask",
  "Hat of Disagreeable Disguise",
  "Hat of Disagreeable Disguise (Greater)",
  "St. Alkitarem's Eye",
  "Wasul Reed Mask",
  "Bralani Breath",
  "Bralani Breath (Greater)",
  "Tanglefoot Extruder",
  "Spider Mold",
  "Fearcracker",
  "Spare Wax Cylinder",
  "Wand of Shattering Images",
  "Owlbear Egg",
  "Warding Punch",
  "Seven-Color Raw Fish Salad",
  "Bound Guardian",
  "Ki Channeling Beads",
  "Marvelous Pigment",
  "Wyrm Claw",
  "Wyrm Claw (Greater)",
  "Wyrm Claw (Major)",
  "Dragontooth Club",
  "Portable Hole",
  "Greengut",
  "Blightburn Necklace",
]);

// ── Class proficiency profiles ──────────────────────────────────────

interface ClassProfile {
  weaponCategories: string[];
  armorCategories: string[];
  wantsShield: boolean;
}

const CLASS_PROFILES: Record<string, ClassProfile> = {
  barbarian: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: false,
  },
  bard: {
    weaponCategories: ["simple"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  champion: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium", "heavy"],
    wantsShield: true,
  },
  cleric: {
    weaponCategories: ["simple"],
    armorCategories: ["light", "medium"],
    wantsShield: true,
  },
  druid: {
    weaponCategories: ["simple"],
    armorCategories: ["light", "medium"],
    wantsShield: true,
  },
  fighter: {
    weaponCategories: ["simple", "martial", "advanced"],
    armorCategories: ["light", "medium", "heavy"],
    wantsShield: true,
  },
  gunslinger: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: false,
  },
  inventor: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: true,
  },
  investigator: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  kineticist: {
    weaponCategories: ["simple"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  magus: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: false,
  },
  monk: {
    weaponCategories: ["simple", "unarmed"],
    armorCategories: ["unarmored"],
    wantsShield: false,
  },
  oracle: {
    weaponCategories: ["simple"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  psychic: {
    weaponCategories: ["simple"],
    armorCategories: ["unarmored"],
    wantsShield: false,
  },
  ranger: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: false,
  },
  rogue: {
    weaponCategories: ["simple"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  sorcerer: {
    weaponCategories: ["simple"],
    armorCategories: ["unarmored"],
    wantsShield: false,
  },
  summoner: {
    weaponCategories: ["simple"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  swashbuckler: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light"],
    wantsShield: false,
  },
  thaumaturge: {
    weaponCategories: ["simple", "martial"],
    armorCategories: ["light", "medium"],
    wantsShield: false,
  },
  witch: {
    weaponCategories: ["simple"],
    armorCategories: ["unarmored"],
    wantsShield: false,
  },
  wizard: {
    weaponCategories: ["simple"],
    armorCategories: ["unarmored"],
    wantsShield: false,
  },
};

/**
 * Compute which classes an item is suitable for, based on proficiency rules.
 * Weapons/armor/shields are class-restricted; everything else suits all classes.
 */
function suggestedClassesForItem(
  type: string,
  category: string,
): string[] | undefined {
  if (type === "weapon") {
    const classes = Object.entries(CLASS_PROFILES)
      .filter(([, p]) => p.weaponCategories.includes(category))
      .map(([c]) => c)
      .sort();
    return classes.length > 0 ? classes : undefined;
  }
  if (type === "armor") {
    const classes = Object.entries(CLASS_PROFILES)
      .filter(([, p]) => p.armorCategories.includes(category))
      .map(([c]) => c)
      .sort();
    return classes.length > 0 ? classes : undefined;
  }
  if (type === "shield") {
    const classes = Object.entries(CLASS_PROFILES)
      .filter(([, p]) => p.wantsShield)
      .map(([c]) => c)
      .sort();
    return classes.length > 0 ? classes : undefined;
  }
  // Consumables, equipment, etc. → no restriction (omit field)
  return undefined;
}

// ── AoN URL matching ────────────────────────────────────────────────

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

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

function loadAonUrls(): {
  exact: Map<string, string>;
  normalized: Map<string, string>;
} {
  const csv = readFileSync(AON_CSV, "utf-8");
  const lines = csv.split("\n");
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvRow(line);
    const name = fields[0];
    const url = fields[fields.length - 1];

    if (name && url && url.startsWith("/")) {
      if (!exact.has(name)) exact.set(name, url);
      const norm = normalizeForMatch(name);
      if (!normalized.has(norm)) normalized.set(norm, url);
    }
  }

  console.log(`Loaded ${exact.size} AoN URLs from CSV.`);
  return { exact, normalized };
}

// ── Foundry item extraction ─────────────────────────────────────────

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

function extractItem(raw: FoundryItem): JsonItem & { _stackGroup?: string } {
  const sys = raw.system;

  const price: Price = {};
  const rawPrice = sys.price?.value;
  if (rawPrice) {
    if (rawPrice.gp) price.gp = rawPrice.gp;
    if (rawPrice.sp) price.sp = rawPrice.sp;
    if (rawPrice.cp) price.cp = rawPrice.cp;
  }

  const type = raw.type;
  const category = sys.category ?? "";

  const item: JsonItem = {
    id: raw._id,
    name: raw.name,
    type,
    level: sys.level?.value ?? 0,
    price,
    category,
    traits: sys.traits?.value ?? [],
    rarity: sys.traits?.rarity ?? "common",
    bulk: sys.bulk?.value ?? 0,
    usage: sys.usage?.value ?? "",
    source: sys.publication?.title ?? "",
    remaster: sys.publication?.remaster ?? false,
    description: sys.description?.value ?? "",
  };

  const classes = suggestedClassesForItem(type, category);
  if (classes) {
    item.suggestedClasses = classes;
  }

  return Object.assign(item, {
    _stackGroup: sys.stackGroup,
  });
}

// ── AoN fallback URLs ───────────────────────────────────────────────

const AON_GEMS_URL = "/Rules.aspx?ID=3228";
const AON_ART_OBJECTS_URL = "/Rules.aspx?ID=3229";

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const rawItems = JSON.parse(
    readFileSync(RAW_INPUT, "utf-8"),
  ) as FoundryItem[];
  console.log(`Read ${rawItems.length} raw items from ${RAW_INPUT}.`);

  const extracted = rawItems.map(extractItem);

  // Separate out stack groups before filtering
  const stackGroups = new Map<string, string>();
  for (const item of extracted) {
    if (item._stackGroup) {
      stackGroups.set(item.id, item._stackGroup);
    }
  }

  // Cast to regular JsonItem[] for the rest of the pipeline
  const items = extracted as JsonItem[];

  // Filter out unpriced items
  const priced = items.filter(
    (item) =>
      item.price.gp !== undefined ||
      item.price.sp !== undefined ||
      item.price.cp !== undefined,
  );
  console.log(
    `Filtered out ${items.length - priced.length} items with no price (${priced.length} remaining).`,
  );

  // Filter out excluded items
  const included = priced.filter((item) => !EXCLUDED_ITEMS.has(item.name));
  if (priced.length - included.length > 0) {
    console.log(
      `Excluded ${priced.length - included.length} items with no AoN page (${included.length} remaining).`,
    );
  }

  // Sort by level, then name
  included.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  // Apply name corrections
  let nameCorrections = 0;
  for (const item of included) {
    const corrected = NAME_CORRECTIONS[item.name];
    if (corrected) {
      item.name = corrected;
      nameCorrections++;
    }
  }
  if (nameCorrections > 0) {
    console.log(`Applied ${nameCorrections} name corrections.`);
  }

  // Match AoN URLs
  const aonUrls = loadAonUrls();
  let matched = 0;
  let normalizedMatched = 0;
  for (const item of included) {
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
    `Matched ${matched} items exactly, ${normalizedMatched} via normalized name (${matched + normalizedMatched}/${included.length} total).`,
  );

  // Apply manual URL overrides
  const overrides = JSON.parse(readFileSync(AON_OVERRIDES, "utf-8")) as Record<
    string,
    string
  >;
  let overrideCount = 0;
  for (const item of included) {
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

  // Assign fallback URLs for treasure items
  let gemCount = 0;
  let artCount = 0;
  for (const item of included) {
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

  // Log class annotation stats
  const withClasses = included.filter((i) => i.suggestedClasses).length;
  console.log(
    `Annotated ${withClasses} items with class suggestions (${included.length - withClasses} are class-agnostic).`,
  );

  mkdirSync("data", { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(included));
  console.log(`Wrote ${included.length} items to ${OUTPUT}`);
}

main();
