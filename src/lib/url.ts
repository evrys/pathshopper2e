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
  return { listId, cart, charName };
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
