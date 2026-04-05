/** Media query matching the mobile breakpoint (≤ 640 px). */
export const MOBILE_QUERY = "(max-width: 640px)";

/** Default rarity filter — show common and uncommon items. */
export const DEFAULT_RARITIES = new Set(["common", "uncommon"]);

/** Default content filter — show remastered items only. */
export const DEFAULT_REMASTER = new Set(["remastered"]);

/** Mapping from item `type` field values to display labels. */
export const TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon",
  armor: "Armor",
  shield: "Shield",
  equipment: "Equipment",
  consumable: "Consumable",
};
