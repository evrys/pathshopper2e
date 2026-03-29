/**
 * Second-pass lookup for items still missing AoN URLs.
 * Tries multiple strategies: legacy pages, stripped names, known patterns.
 *
 * Usage: node scripts/fetch-missing-aon-urls-pass2.mjs 2>&1
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const items = require("../data/items.json");

const missing = items.filter((i) => !i.aonUrl);
console.error(`Looking up ${missing.length} missing items...`);

const AON_ES = "https://elasticsearch.aonprd.com/aon/_search";

async function searchAon(query) {
  const url = `${AON_ES}?q=${encodeURIComponent(query)}&_source=name,url&size=5`;
  const res = await fetch(url);
  const data = await res.json();
  return data.hits?.hits ?? [];
}

function norm(s) {
  return s
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[-\s]+/g, " ")
    .replace(/\./g, "")
    .trim();
}

// Known pattern overrides
const PATTERN_OVERRIDES = {
  // All scroll variants → Magic Scroll page
  "Scroll of 1st-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 2nd-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 3rd-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 4th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 5th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 6th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 7th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 8th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 9th-rank Spell": "/Equipment.aspx?ID=2962",
  "Scroll of 10th-rank Spell": "/Equipment.aspx?ID=2962",
  // Coins → Coins and Currency rules page
  "Copper Pieces": "/Rules.aspx?ID=2144",
  "Silver Pieces": "/Rules.aspx?ID=2144",
  "Gold Pieces": "/Rules.aspx?ID=2144",
  "Platinum Pieces": "/Rules.aspx?ID=2144",
  // Barding variants → Barding page
  "Light Barding": "/Equipment.aspx?ID=2778",
  "Heavy Barding (Small or Medium)": "/Equipment.aspx?ID=2778",
  "Heavy Barding (Large)": "/Equipment.aspx?ID=2778",
  // Firearm rounds → generic ammunition page
  "Rounds (Arquebus)": "/Weapons.aspx?ID=588",
  "Rounds (Axe Musket)": "/Weapons.aspx?ID=588",
  "Rounds (Black Powder Knuckle Dusters)": "/Weapons.aspx?ID=588",
  "Rounds (Blunderbuss)": "/Weapons.aspx?ID=588",
  "Rounds (Cane Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Clan Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Coat Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Dagger Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Dawnsilver Tree)": "/Weapons.aspx?ID=588",
  "Rounds (Double-Barreled Musket)": "/Weapons.aspx?ID=588",
  "Rounds (Double-Barreled Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Dragon Mouth Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Dueling Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Dwarven Scattergun)": "/Weapons.aspx?ID=588",
  "Rounds (Explosive Dogslicer)": "/Weapons.aspx?ID=588",
  "Rounds (Fire Lance)": "/Weapons.aspx?ID=588",
  "Rounds (Flingflenser)": "/Weapons.aspx?ID=588",
  "Rounds (Flintlock Musket)": "/Weapons.aspx?ID=588",
  "Rounds (Flintlock Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Gnome Amalgam Musket)": "/Weapons.aspx?ID=588",
  "Rounds (Gun Sword)": "/Weapons.aspx?ID=588",
  "Rounds (Hammer Gun)": "/Weapons.aspx?ID=588",
  "Rounds (Hand Cannon)": "/Weapons.aspx?ID=588",
  "Rounds (Harmona Gun)": "/Weapons.aspx?ID=588",
  "Rounds (Jezail)": "/Weapons.aspx?ID=588",
  "Rounds (Mace Multipistol)": "/Weapons.aspx?ID=588",
  "Rounds (Pepperbox)": "/Weapons.aspx?ID=588",
  "Rounds (Piercing Wind)": "/Weapons.aspx?ID=588",
  "Rounds (Rapier Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Slide Pistol)": "/Weapons.aspx?ID=588",
  "Rounds (Three-peaked Tree)": "/Weapons.aspx?ID=588",
  // Dragon breath potions → legacy CRB page
  "Black Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Black Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Black Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  "Brass Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Brass Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Brass Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  "Bronze Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Bronze Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Bronze Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  "Green Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Green Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Green Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  "Red Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Red Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Red Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  "Silver Dragon's Breath Potion (Young)": "/Equipment.aspx?ID=185",
  "Silver Dragon's Breath Potion (Adult)": "/Equipment.aspx?ID=185",
  "Silver Dragon's Breath Potion (Wyrm)": "/Equipment.aspx?ID=185",
  // Potions of Resistance → remaster page
  "Potion of Acid Resistance (Lesser)": "/Equipment.aspx?ID=2951",
  "Potion of Acid Resistance (Moderate)": "/Equipment.aspx?ID=2951",
  "Potion of Acid Resistance (Greater)": "/Equipment.aspx?ID=2951",
  "Potion of Cold Resistance (Lesser)": "/Equipment.aspx?ID=2951",
  "Potion of Cold Resistance (Moderate)": "/Equipment.aspx?ID=2951",
  "Potion of Cold Resistance (Greater)": "/Equipment.aspx?ID=2951",
  "Potion of Electricity Resistance (Lesser)": "/Equipment.aspx?ID=2951",
  "Potion of Electricity Resistance (Moderate)": "/Equipment.aspx?ID=2951",
  "Potion of Electricity Resistance (Greater)": "/Equipment.aspx?ID=2951",
  "Potion of Fire Resistance (Lesser)": "/Equipment.aspx?ID=2951",
  "Potion of Fire Resistance (Moderate)": "/Equipment.aspx?ID=2951",
  "Potion of Fire Resistance (Greater)": "/Equipment.aspx?ID=2951",
  "Potion of Sonic Resistance (Lesser)": "/Equipment.aspx?ID=2951",
  "Potion of Sonic Resistance (Moderate)": "/Equipment.aspx?ID=2951",
  "Potion of Sonic Resistance (Greater)": "/Equipment.aspx?ID=2951",
  // Potions of Retaliation → remaster page
  "Potion of Acid Retaliation (Minor)": "/Equipment.aspx?ID=3404",
  "Potion of Acid Retaliation (Lesser)": "/Equipment.aspx?ID=3404",
  "Potion of Acid Retaliation (Moderate)": "/Equipment.aspx?ID=3404",
  "Potion of Acid Retaliation (Greater)": "/Equipment.aspx?ID=3404",
  "Potion of Acid Retaliation (Major)": "/Equipment.aspx?ID=3404",
  "Potion of Cold Retaliation (Minor)": "/Equipment.aspx?ID=3404",
  "Potion of Cold Retaliation (Lesser)": "/Equipment.aspx?ID=3404",
  "Potion of Cold Retaliation (Moderate)": "/Equipment.aspx?ID=3404",
  "Potion of Cold Retaliation (Greater)": "/Equipment.aspx?ID=3404",
  "Potion of Cold Retaliation (Major)": "/Equipment.aspx?ID=3404",
  "Potion of Electricity Retaliation (Minor)": "/Equipment.aspx?ID=3404",
  "Potion of Electricity Retaliation (Lesser)": "/Equipment.aspx?ID=3404",
  "Potion of Electricity Retaliation (Moderate)": "/Equipment.aspx?ID=3404",
  "Potion of Electricity Retaliation (Greater)": "/Equipment.aspx?ID=3404",
  "Potion of Electricity Retaliation (Major)": "/Equipment.aspx?ID=3404",
  "Potion of Fire Retaliation (Minor)": "/Equipment.aspx?ID=3404",
  "Potion of Fire Retaliation (Lesser)": "/Equipment.aspx?ID=3404",
  "Potion of Fire Retaliation (Moderate)": "/Equipment.aspx?ID=3404",
  "Potion of Fire Retaliation (Greater)": "/Equipment.aspx?ID=3404",
  "Potion of Fire Retaliation (Major)": "/Equipment.aspx?ID=3404",
  // Legacy CRB named items → their legacy pages
  "Boots of Elvenkind": "/Equipment.aspx?ID=416",
  "Boots of Elvenkind (Greater)": "/Equipment.aspx?ID=416",
  "Cloak of Elvenkind": "/Equipment.aspx?ID=422",
  "Cloak of Elvenkind (Greater)": "/Equipment.aspx?ID=422",
  "Hand of the Mage": "/Equipment.aspx?ID=439",
  "Slippers of Spider Climbing": "/Equipment.aspx?ID=460",
  "Rod of Wonder": "/Equipment.aspx?ID=265",
  Oathbow: "/Equipment.aspx?ID=392",
  "Frost Brand": "/Equipment.aspx?ID=434",
  "Staff of Power": "/Equipment.aspx?ID=342",
  "Belt of Giant Strength": "/Equipment.aspx?ID=398",
  "Plate Armor of the Deep": "/Equipment.aspx?ID=157",
  "Helm of Underwater Action": "/Equipment.aspx?ID=442",
  "Helm of Underwater Action (Greater)": "/Equipment.aspx?ID=442",
  "Necklace of Fireballs I": "/Equipment.aspx?ID=449",
  // Dwarven War Axe → legacy weapon page
  "Dwarven War Axe": "/Weapons.aspx?ID=420",
  // Spray Pellets → Spray Pellet (plural/singular)
  "Spray Pellets": "/Weapons.aspx?ID=353",
  // Versatile Vial → not a standalone item on AoN (it's part of the alchemist class)
  // Faerie Dragon Liqueur → legacy page
  "Faerie Dragon Liqueur (Young)": "/Equipment.aspx?ID=186",
  "Faerie Dragon Liqueur (Adult)": "/Equipment.aspx?ID=186",
  "Faerie Dragon Liqueur (Wyrm)": "/Equipment.aspx?ID=186",
  // Spellbreaking items → legacy page
  "Spellbreaking (Abjuration)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Conjuration)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Divination)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Enchantment)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Evocation)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Illusion)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Necromancy)": "/Equipment.aspx?ID=466",
  "Spellbreaking (Transmutation)": "/Equipment.aspx?ID=466",
  // Depth Charges → all variants on same page (AoN uses Roman numerals in parens)
  "Depth Charge I": "/Equipment.aspx?ID=2048",
  "Depth Charge II": "/Equipment.aspx?ID=2048",
  "Depth Charge III": "/Equipment.aspx?ID=2048",
  "Depth Charge IV": "/Equipment.aspx?ID=2048",
  "Depth Charge V": "/Equipment.aspx?ID=2048",
  "Depth Charge VI": "/Equipment.aspx?ID=2048",
  "Depth Charge VII": "/Equipment.aspx?ID=2048",
  // Highhelm Drill → all variants on same page (AoN uses "Mark I" etc. in parens)
  "Highhelm Drill Mark I": "/Equipment.aspx?ID=2566",
  "Highhelm Drill Mark II": "/Equipment.aspx?ID=2566",
  "Highhelm Drill Mark III": "/Equipment.aspx?ID=2566",
  // Judgment Thurible → "Judgement" spelling on AoN
  "Judgment Thurible": "/Equipment.aspx?ID=2232",
  "Judgment Thurible (Greater)": "/Equipment.aspx?ID=2232",
  "Judgment Thurible (Major)": "/Equipment.aspx?ID=2232",
  // Peshpine Grenade → "Peshspine" spelling on AoN
  "Peshpine Grenade (Lesser)": "/Equipment.aspx?ID=549",
  "Peshpine Grenade (Moderate)": "/Equipment.aspx?ID=549",
  "Peshpine Grenade (Greater)": "/Equipment.aspx?ID=549",
  "Peshpine Grenade (Major)": "/Equipment.aspx?ID=549",
  // Hag Eye variants → all on same page
  "Frightful Hag Eye": "/Equipment.aspx?ID=935",
  "Oracular Hag Eye": "/Equipment.aspx?ID=935",
  "Stony Hag Eye": "/Equipment.aspx?ID=935",
  "Smoky Hag Eye": "/Equipment.aspx?ID=935",
  // Awakened Metal Shot variants → all on same page
  "Awakened Cold Iron Shot": "/Equipment.aspx?ID=4293",
  "Awakened Silver Shot": "/Equipment.aspx?ID=4293",
  "Awakened Adamantine Shot": "/Equipment.aspx?ID=4293",
  // Death Knell Powder → legacy page
  "Death Knell Powder": "/Equipment.aspx?ID=827",
  // Mythic Resilient → "Mythic Resilent" typo on AoN
  "Mythic Resilient": "/Equipment.aspx?ID=3499",
  // Busine of Divine Reinforcements → "Reinforcement" singular on AoN
  "Busine of Divine Reinforcements": "/Equipment.aspx?ID=1566",
  // Thieves' Tools variants → all on same page
  "Thieves' Tools (Concealable)": "/Equipment.aspx?ID=58",
  "Thieves' Tools (Concealable Picks)": "/Equipment.aspx?ID=58",
  // Worldforge → "World Forge" (two words) on AoN
  Worldforge: "/Equipment.aspx?ID=3511",
  // Energy Robe variants → all on same page
  "Energy Robe of Fire": "/Equipment.aspx?ID=1317",
  "Energy Robe of Cold": "/Equipment.aspx?ID=1317",
  "Energy Robe of Acid": "/Equipment.aspx?ID=1317",
  "Energy Robe of Electricity": "/Equipment.aspx?ID=1317",
  // Spore Shephard's Staff → "Shepherd" spelling on AoN
  "Spore Shephard's Staff": "/Equipment.aspx?ID=2665",
  "Spore Shephard's Staff (Greater)": "/Equipment.aspx?ID=2665",
  "Spore Shephard's Staff (Major)": "/Equipment.aspx?ID=2665",
};

// Apply pattern overrides first
const patternFound = {};
const stillNeedLookup = [];
for (const item of missing) {
  const url = PATTERN_OVERRIDES[item.name];
  if (url) {
    patternFound[item.name] = url;
  } else {
    stillNeedLookup.push(item);
  }
}
console.error(`Pattern overrides: ${Object.keys(patternFound).length}`);
console.error(`Still need lookup: ${stillNeedLookup.length}`);

// For remaining items, try ES lookup with stripped name
const esFound = {};
const notFound = [];

const BATCH = 5;
for (let i = 0; i < stillNeedLookup.length; i += BATCH) {
  const batch = stillNeedLookup.slice(i, i + BATCH);
  await Promise.all(
    batch.map(async (item) => {
      // Try exact quoted name
      let hits = await searchAon(`"${item.name}"`);
      if (hits.length > 0 && norm(hits[0]._source.name) === norm(item.name)) {
        esFound[item.name] = hits[0]._source.url;
        return;
      }
      // Try stripped name (remove parentheticals)
      const stripped = item.name.replace(/\s*\([^)]*\)/g, "").trim();
      if (stripped !== item.name) {
        hits = await searchAon(`"${stripped}"`);
        if (hits.length > 0 && norm(hits[0]._source.name) === norm(stripped)) {
          esFound[item.name] = hits[0]._source.url;
          return;
        }
      }
      notFound.push(item.name);
    }),
  );
  process.stderr.write(
    `\r  ES lookup: ${i + batch.length}/${stillNeedLookup.length}...`,
  );
  await new Promise((r) => setTimeout(r, 50));
}
process.stderr.write("\n");

console.error(`\nES found: ${Object.keys(esFound).length}`);
console.error(`Not found: ${notFound.length}`);
console.error("\nNot found:");
for (const n of notFound) console.error(" ", n);

// Merge all found
const allFound = { ...patternFound, ...esFound };
writeFileSync("/tmp/aon-found-pass2.json", JSON.stringify(allFound, null, 2));
console.error(
  `\nWrote /tmp/aon-found-pass2.json with ${Object.keys(allFound).length} entries`,
);
