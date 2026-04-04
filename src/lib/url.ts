import type { Discount, Item, Price } from "../types";

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
 * Parsed cart data from a `+`-separated cart string.
 */
export interface ParsedCart {
  cart: Map<string, number>;
  discounts: Map<string, Discount>;
}

/**
 * Parse a `+`-separated cart string into item quantities and discounts.
 *
 * Format: entries joined by `+`. Each entry is one of:
 *   - `id`             → qty 1, no discount
 *   - `id*qty`         → qty N, no discount
 *   - `id~dCOPPER`     → qty 1, flat discount in copper
 *   - `id*qty~dCOPPER` → qty N, flat discount in copper
 *   - `id~pPERCENT`    → qty 1, percentage discount
 *   - `id*qty~pPERCENT` → qty N, percentage discount
 *
 * The `*` separator is used for quantities because `encodeURIComponent`
 * doesn't encode it. The `~d` prefix marks a flat discount in copper;
 * `~p` marks a percentage discount. The legacy `:` separator is also
 * accepted for backwards-compatible quantity parsing.
 */
export function parseCartString(cartStr: string): ParsedCart {
  const cart = new Map<string, number>();
  const discounts = new Map<string, Discount>();
  if (!cartStr) return { cart, discounts };

  for (const entry of cartStr.split("+")) {
    // Split off optional discount suffix (~dNNN or ~pNNN)
    const discountMatch = entry.match(/~([dp])(\d+)$/);
    const mainPart = discountMatch
      ? entry.slice(0, entry.length - discountMatch[0].length)
      : entry;

    // Parse id and quantity from the main part
    // Support both `*` (current) and `:` (legacy) as quantity separators
    const sepIdx = Math.max(
      mainPart.lastIndexOf("*"),
      mainPart.lastIndexOf(":"),
    );
    let id: string;
    let qty: number;
    if (sepIdx === -1) {
      id = mainPart;
      qty = 1;
    } else {
      id = mainPart.slice(0, sepIdx);
      qty = Number.parseInt(mainPart.slice(sepIdx + 1), 10);
      if (id && Number.isNaN(qty)) {
        // Non-numeric suffix — treat whole mainPart as id with qty 1
        id = mainPart;
        qty = 1;
      }
    }

    if (!id || qty <= 0) continue;
    cart.set(id, qty);

    // Parse optional discount
    if (discountMatch) {
      const kind = discountMatch[1];
      const value = Number.parseInt(discountMatch[2], 10);
      if (Number.isFinite(value) && value > 0) {
        if (kind === "p") {
          discounts.set(id, { type: "percent", percent: value });
        } else {
          discounts.set(id, { type: "flat", cp: value });
        }
      }
    }
  }

  return { cart, discounts };
}

export interface ShareParams {
  listId: string;
  cart: Map<string, number>;
  charName: string;
  /** Custom item definitions embedded in the share URL, if any. */
  customItems: Item[];
  /** Per-item discounts, keyed by item id. */
  discounts: Map<string, Discount>;
  /** Per-item notes, keyed by item id. */
  notes: Map<string, string>;
}

/**
 * Extract share-link parameters (list id, cart items, character name) from
 * a parsed URLSearchParams. Used by both the editor (App) and the readonly
 * shared-list view.
 */
export function parseShareParams(params: URLSearchParams): ShareParams {
  const charName = params.get("name") ?? params.get("char") ?? "";
  const { cart, discounts } = parseCartString(
    params.get("items") ?? params.get("cart") ?? "",
  );
  const listId = params.get("lid") ?? "";
  const customItems = parseCustomItems(params.get("custom") ?? "");
  const notes = parseNotes(params.get("notes") ?? "");
  return { listId, cart, charName, customItems, discounts, notes };
}

/**
 * Serialize a cart Map into the `+`-separated format used in share URLs.
 *
 * Each entry is one of:
 *   - `id`              — qty 1, no discount
 *   - `id*qty`          — qty > 1, no discount
 *   - `id~dCOPPER`      — qty 1, flat discount
 *   - `id*qty~dCOPPER`  — qty > 1, flat discount
 *   - `id~pPERCENT`     — qty 1, percentage discount
 *   - `id*qty~pPERCENT` — qty > 1, percentage discount
 */
export function serializeCart(
  cart: Map<string, number>,
  discounts?: Map<string, Discount>,
): string {
  return [...cart]
    .map(([id, qty]) => {
      let s = qty === 1 ? id : `${id}*${qty}`;
      const d = discounts?.get(id);
      if (d) {
        s += d.type === "percent" ? `~p${d.percent}` : `~d${d.cp}`;
      }
      return s;
    })
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

// ── Notes encoding for share URLs ────────────────────────────────────

/**
 * Serialize per-item notes for embedding in a share URL.
 *
 * Format: entries separated by `|`. Each entry is `id:text` where `text`
 * has `|` and `:` escaped so the delimiters are unambiguous.
 */
export function serializeNotes(
  notes: ReadonlyMap<string, string>,
  idMap?: ReadonlyMap<string, string>,
): string {
  const parts: string[] = [];
  for (const [id, text] of notes) {
    if (!text) continue;
    const mappedId = idMap?.get(id) ?? id;
    // Escape : and | within the text so they don't break parsing
    const escaped = text
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\c")
      .replace(/\|/g, "\\p");
    parts.push(`${mappedId}:${escaped}`);
  }
  return parts.join("|");
}

/**
 * Parse per-item notes from a share URL param.
 *
 * Reverses the encoding from `serializeNotes`.
 */
export function parseNotes(str: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!str) return map;
  for (const entry of str.split("|")) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const id = entry.slice(0, colonIdx);
    const escaped = entry.slice(colonIdx + 1);
    // Unescape in reverse order
    const text = escaped
      .replace(/\\p/g, "|")
      .replace(/\\c/g, ":")
      .replace(/\\\\/g, "\\");
    if (id && text) map.set(id, text);
  }
  return map;
}
