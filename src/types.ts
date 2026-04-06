/** Price in Pathfinder 2e currency (gold/silver/copper pieces) */
export interface Price {
  gp?: number;
  sp?: number;
  cp?: number;
}

/** A modifier applied to an item's price (positive = surcharge, negative = discount). */
export type PriceModifier =
  | { type: "flat"; cp: number }
  | { type: "percent"; percent: number }
  | { type: "upgrade"; cp: number }
  | { type: "crafting" }
  | { type: "sell" };

/** Item as stored in JSON (before runtime enrichment) */
export type JsonItem = Omit<Item, "plainDescription">;

/** A Pathfinder 2e equipment item */
export interface Item {
  /** Unique identifier derived from Archives of Nethys (e.g. "e1082", "w386") */
  id: string;
  /** Display name */
  name: string;
  /** Top-level type: weapon, armor, consumable, equipment, etc. */
  type: string;
  /** Item level */
  level: number;
  /** Price in gp/sp/cp */
  price: Price;
  /** Sub-category, e.g. "Base Weapons", "Talismans", "Other Worn Items" */
  category: string;
  /** Trait tags, e.g. ["flexible", "noisy"] */
  traits: string[];
  /** Rarity: common, uncommon, rare, unique */
  rarity: string;
  /** Bulk value (L = 0.1) */
  bulk: number;
  /** Usage string, e.g. "worn gloves", "held in 1 hand" */
  usage: string;
  /** Source book title */
  source: string;
  /** AoN source ID (from /Sources.aspx?ID=N) */
  sourceId: string;
  /** Whether this is remastered content (not a legacy pre-remaster item) */
  remaster: boolean;
  /** HTML description (converted from AoN markdown) */
  description: string;
  /** Plain-text version of description (HTML stripped), for search indexing */
  plainDescription: string;
  /** URL path on Archives of Nethys, e.g. "/Equipment.aspx?ID=1082" */
  aonUrl?: string;
}
