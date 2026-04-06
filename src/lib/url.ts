import type { Item, Price, PriceModifier } from "../types";

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
  priceModifiers: Map<string, PriceModifier>;
}

/**
 * Parse a `+`-separated cart string into item quantities and price modifiers.
 *
 * Format: entries joined by `+`. Each entry is one of:
 *   - `id`             → qty 1, no modifier
 *   - `id*qty`         → qty N, no modifier
 *   - `id~dCOPPER`     → qty 1, flat modifier in copper (positive = surcharge, negative = discount)
 *   - `id*qty~dCOPPER` → qty N, flat modifier in copper
 *   - `id~pPERCENT`    → qty 1, percentage modifier (positive = surcharge, negative = discount)
 *   - `id*qty~pPERCENT` → qty N, percentage modifier
 *   - `id~uCOPPER`     → qty 1, upgrade modifier in copper (always a discount)
 *   - `id*qty~uCOPPER` → qty N, upgrade modifier in copper
 *   - `id~c`           → qty 1, crafting modifier (-50%)
 *   - `id*qty~c`       → qty N, crafting modifier (-50%)
 *   - `id~s`           → qty 1, sell modifier (receive 50% value)
 *   - `id*qty~s`       → qty N, sell modifier (receive 50% value)
 *
 * The `*` separator is used for quantities because `encodeURIComponent`
 * doesn't encode it. The `~d` prefix marks a flat modifier in copper;
 * `~p` marks a percentage modifier; `~u` marks an upgrade modifier;
 * `~c` marks a crafting modifier; `~s` marks a sell modifier.
 * The legacy `:` separator is also
 * accepted for backwards-compatible quantity parsing.
 */
export function parseCartString(cartStr: string): ParsedCart {
  const cart = new Map<string, number>();
  const priceModifiers = new Map<string, PriceModifier>();
  if (!cartStr) return { cart, priceModifiers };

  for (const entry of cartStr.split("+")) {
    // Split off optional modifier suffix (~dNNN, ~pNNN, ~uNNN, ~c, or ~s)
    // Values may be negative for flat/percent modifiers (e.g. ~d-500 for a discount)
    const modifierMatch = entry.match(/~([dpu])(-?\d+)$|~([cs])$/);
    const mainPart = modifierMatch
      ? entry.slice(0, entry.length - modifierMatch[0].length)
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

    // Parse optional price modifier
    if (modifierMatch) {
      if (modifierMatch[3] === "c") {
        priceModifiers.set(id, { type: "crafting" });
      } else if (modifierMatch[3] === "s") {
        priceModifiers.set(id, { type: "sell" });
      } else {
        const kind = modifierMatch[1];
        const value = Number.parseInt(modifierMatch[2], 10);
        if (Number.isFinite(value) && value !== 0) {
          if (kind === "p") {
            priceModifiers.set(id, { type: "percent", percent: value });
          } else if (kind === "u") {
            priceModifiers.set(id, { type: "upgrade", cp: value });
          } else {
            priceModifiers.set(id, { type: "flat", cp: value });
          }
        }
      }
    }
  }

  return { cart, priceModifiers };
}

export interface ShareParams {
  listId: string;
  cart: Map<string, number>;
  charName: string;
  /** Custom item definitions embedded in the share URL, if any. */
  customItems: Item[];
  /** Per-item price modifiers, keyed by item id. */
  priceModifiers: Map<string, PriceModifier>;
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
  const { cart, priceModifiers } = parseCartString(
    params.get("items") ?? params.get("cart") ?? "",
  );
  const listId = params.get("lid") ?? "";
  const customItems = parseCustomItems(params.get("custom") ?? "");
  const notes = parseNotes(params.get("notes") ?? "");
  return { listId, cart, charName, customItems, priceModifiers, notes };
}

/**
 * Serialize a cart Map into the `+`-separated format used in share URLs.
 *
 * Each entry is one of:
 *   - `id`              — qty 1, no modifier
 *   - `id*qty`          — qty > 1, no modifier
 *   - `id~dCOPPER`      — qty 1, flat modifier
 *   - `id*qty~dCOPPER`  — qty > 1, flat modifier
 *   - `id~pPERCENT`     — qty 1, percentage modifier
 *   - `id*qty~pPERCENT` — qty > 1, percentage modifier
 */
export function serializeCart(
  cart: Map<string, number>,
  priceModifiers?: Map<string, PriceModifier>,
): string {
  return [...cart]
    .map(([id, qty]) => {
      let s = qty === 1 ? id : `${id}*${qty}`;
      const d = priceModifiers?.get(id);
      if (d) {
        if (d.type === "percent") {
          s += `~p${d.percent}`;
        } else if (d.type === "crafting") {
          s += "~c";
        } else if (d.type === "sell") {
          s += "~s";
        } else if (d.type === "upgrade") {
          s += `~u${d.cp}`;
        } else {
          s += `~d${d.cp}`;
        }
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
      sourceId: "",
      sourceCategory: "",
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
