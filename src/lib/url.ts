import type { Item, Price } from "../types";

/**
 * Parse a URL hash string into URLSearchParams.
 *
 * Handles the `+` encoding issue: literal `+` in our hashes represents a
 * separator (not a space), so we escape them before URLSearchParams parses
 * them.
 */
export function parseHashParams(hash: string): URLSearchParams {
  const str = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(str.replace(/\+/g, "%2B"));
}

/**
 * Serialize URLSearchParams into a `#`-prefixed hash string, keeping `+`
 * unencoded for readability.
 */
export function buildHashString(params: URLSearchParams): string {
  const parts: string[] = [];
  for (const [key, value] of params) {
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%2B/gi, "+")}`,
    );
  }
  return parts.length > 0 ? `#${parts.join("&")}` : "";
}

/**
 * Parse a `+`-separated cart string (e.g. "itemId1+itemId2*3+itemId3")
 * into a Map of item id → quantity.
 *
 * Format: entries joined by `+`, each is either `id` (qty 1) or `id*qty`.
 * The `*` separator is used because `encodeURIComponent` doesn't encode it,
 * keeping URLs clean. The legacy `:` separator is also accepted for
 * backwards compatibility.
 */
export function parseCartString(cartStr: string): Map<string, number> {
  const cart = new Map<string, number>();
  if (!cartStr) return cart;

  for (const entry of cartStr.split("+")) {
    // Support both `*` (current) and `:` (legacy) as quantity separators
    const sepIdx = Math.max(entry.lastIndexOf("*"), entry.lastIndexOf(":"));
    if (sepIdx === -1) {
      cart.set(entry, 1);
    } else {
      const id = entry.slice(0, sepIdx);
      const qty = Number.parseInt(entry.slice(sepIdx + 1), 10);
      if (id && Number.isFinite(qty) && qty > 0) {
        cart.set(id, qty);
      } else if (id && Number.isNaN(qty)) {
        // No numeric suffix after separator — treat whole thing as id with qty 1
        cart.set(entry, 1);
      }
      // qty <= 0: skip (invalid)
    }
  }

  return cart;
}

export interface ShareParams {
  listId: string;
  cart: Map<string, number>;
  charName: string;
  /** Custom item definitions embedded in the share URL, if any. */
  customItems: Item[];
}

/**
 * Extract share-link parameters (list id, cart items, character name) from
 * a parsed URLSearchParams. Used by both the editor (App) and the readonly
 * shared-list view.
 */
export function parseShareParams(params: URLSearchParams): ShareParams {
  const charName = params.get("name") ?? params.get("char") ?? "";
  const cart = parseCartString(params.get("items") ?? params.get("cart") ?? "");
  const listId = params.get("lid") ?? "";
  const customItems = parseCustomItems(params.get("custom") ?? "");
  return { listId, cart, charName, customItems };
}

/**
 * Serialize a cart Map into the `+`-separated format used in share URLs.
 * Items with qty 1 are just the id; items with qty > 1 use `id*qty`.
 */
export function serializeCart(cart: Map<string, number>): string {
  return [...cart]
    .map(([id, qty]) => (qty === 1 ? id : `${id}*${qty}`))
    .join("+");
}

// ── Custom-item encoding for share URLs ──────────────────────────────

/**
 * Compact price → string: "50gp", "10sp", "3cp", or "" for free.
 * Only one denomination is stored (custom items use a single denomination).
 */
function serializePrice(price: Price): string {
  if (price.gp) return `${price.gp}gp`;
  if (price.sp) return `${price.sp}sp`;
  if (price.cp) return `${price.cp}cp`;
  return "";
}

/** Parse a compact price string like "50gp" back into a Price. */
function parsePrice(s: string): Price {
  if (!s) return {};
  const m = s.match(/^(\d+)(gp|sp|cp)$/);
  if (!m) return {};
  return { [m[2]]: Number(m[1]) };
}

/**
 * Serialize custom cart entries for embedding in a share URL.
 *
 * Format: entries separated by `,`. Each entry is `name~price` where price
 * is a compact string like "50gp". The `~` separator is safe inside
 * `encodeURIComponent`. Quantity is tracked in the normal `items` param.
 */
export function serializeCustomItems(entries: { item: Item }[]): string {
  return entries
    .map((e) => {
      const p = serializePrice(e.item.price);
      return p ? `${e.item.name}~${p}` : e.item.name;
    })
    .join(",");
}

/**
 * Parse custom item definitions from a share URL param back into Item
 * objects, keyed by their generated custom id.
 *
 * Each custom item gets a stable id derived from its index so that the
 * corresponding quantities in the `items` cart param can reference it.
 */
export function parseCustomItems(str: string): Item[] {
  if (!str) return [];
  return str.split(",").map((entry, i) => {
    const tildeIdx = entry.lastIndexOf("~");
    const name = tildeIdx === -1 ? entry : entry.slice(0, tildeIdx);
    const priceStr = tildeIdx === -1 ? "" : entry.slice(tildeIdx + 1);
    return {
      id: `custom-${i}`,
      name,
      type: "equipment",
      level: 0,
      price: parsePrice(priceStr),
      category: "Custom",
      traits: [],
      rarity: "common",
      bulk: 0,
      usage: "",
      source: "Custom",
      remaster: false,
      description: "",
      plainDescription: "",
    };
  });
}

/**
 * Build a mapping from a list of cart entries' custom item ids to stable
 * share-URL custom ids (`custom-0`, `custom-1`, …). This lets us
 * re-key the cart quantities so they reference the ids produced by
 * `parseCustomItems` on the receiving end.
 */
export function buildCustomIdMap(
  entries: { item: Item; quantity: number }[],
): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const e of entries) {
    if (e.item.id.startsWith("custom-")) {
      map.set(e.item.id, `custom-${idx++}`);
    }
  }
  return map;
}
