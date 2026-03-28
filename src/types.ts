/** Price in Pathfinder 2e currency (gold/silver/copper pieces) */
export interface Price {
  gp?: number;
  sp?: number;
  cp?: number;
}

/** A Pathfinder 2e equipment item */
export interface Item {
  /** Unique identifier from Foundry */
  id: string;
  /** Display name */
  name: string;
  /** Top-level type: weapon, armor, consumable, equipment, etc. */
  type: string;
  /** Item level */
  level: number;
  /** Price in gp/sp/cp */
  price: Price;
  /** Sub-category, e.g. "martial", "medium", "potion" */
  category: string;
  /** Trait tags, e.g. ["flexible", "noisy"] */
  traits: string[];
  /** Rarity: common, uncommon, rare, unique */
  rarity: string;
  /** Bulk value (L = 0.1) */
  bulk: number;
  /** Usage string, e.g. "held-in-one-hand" */
  usage: string;
  /** Source book title */
  source: string;
  /** Whether this is remastered content */
  remaster: boolean;
  /** HTML description */
  description: string;
  /** Plain-text version of description (HTML stripped), for search indexing */
  plainDescription: string;
  /** URL path on Archives of Nethys, e.g. "/Weapons.aspx?ID=386" */
  aonUrl?: string;
}
