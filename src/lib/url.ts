/**
 * Parse a `+`-separated cart string (e.g. "itemId1+itemId2:3+itemId3")
 * into a Map of item id → quantity.
 *
 * Format: entries joined by `+`, each is either `id` (qty 1) or `id:qty`.
 */
export function parseCartString(cartStr: string): Map<string, number> {
  const cart = new Map<string, number>();
  if (!cartStr) return cart;

  for (const entry of cartStr.split("+")) {
    const colonIdx = entry.lastIndexOf(":");
    if (colonIdx === -1) {
      cart.set(entry, 1);
    } else {
      const id = entry.slice(0, colonIdx);
      const qty = Number.parseInt(entry.slice(colonIdx + 1), 10);
      if (id && Number.isFinite(qty) && qty > 0) {
        cart.set(id, qty);
      } else if (id && Number.isNaN(qty)) {
        // No numeric suffix after colon — treat whole thing as id with qty 1
        cart.set(entry, 1);
      }
      // qty <= 0: skip (invalid)
    }
  }

  return cart;
}
