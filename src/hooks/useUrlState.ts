import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * App state that gets persisted in the URL hash.
 * Only non-default values are serialized to keep URLs short.
 */
export interface UrlState {
  search: string;
  types: Set<string>;
  rarities: Set<string>;
  remaster: Set<string>;
  minLevel: string;
  maxLevel: string;
  sort: string; // "field:dir", e.g. "name:asc"
  /** Cart as Map of item id → quantity */
  cart: Map<string, number>;
}

const DEFAULT_RARITIES = new Set(["common", "uncommon"]);
const DEFAULT_REMASTER = new Set(["remastered"]);

const DEFAULTS: UrlState = {
  search: "",
  types: new Set(),
  rarities: DEFAULT_RARITIES,
  remaster: DEFAULT_REMASTER,
  minLevel: "",
  maxLevel: "",
  sort: "name:asc",
  cart: new Map(),
};

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

/** Serialize state to a URL hash string. Only includes non-default values. */
function serialize(state: UrlState): string {
  const params = new URLSearchParams();

  if (state.search) params.set("q", state.search);
  if (state.types.size > 0)
    params.set("type", [...state.types].sort().join(","));
  if (!setsEqual(state.rarities, DEFAULT_RARITIES))
    params.set("rarity", [...state.rarities].sort().join(","));
  if (!setsEqual(state.remaster, DEFAULT_REMASTER))
    params.set("remaster", [...state.remaster].sort().join(","));
  if (state.minLevel) params.set("minlvl", state.minLevel);
  if (state.maxLevel) params.set("maxlvl", state.maxLevel);
  if (state.sort !== DEFAULTS.sort) params.set("sort", state.sort);

  if (state.cart.size > 0) {
    const cartStr = [...state.cart]
      .map(([id, qty]) => (qty === 1 ? id : `${id}:${qty}`))
      .join(",");
    params.set("cart", cartStr);
  }

  const str = params.toString();
  return str ? `#${str}` : "";
}

/** Parse URL hash string back into state. */
function deserialize(hash: string): UrlState {
  const str = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(str);

  const search = params.get("q") ?? "";

  const typeStr = params.get("type");
  const types = typeStr ? new Set(typeStr.split(",")) : new Set<string>();

  const rarityStr = params.get("rarity");
  // If rarity param is absent, use defaults. If present but empty, means "all rarities" (empty set).
  const rarities =
    rarityStr === null
      ? new Set(DEFAULT_RARITIES)
      : rarityStr === ""
        ? new Set<string>()
        : new Set(rarityStr.split(","));

  const remasterStr = params.get("remaster");
  // If remaster param is absent, use defaults. If present but empty, means "all content" (empty set).
  const remaster =
    remasterStr === null
      ? new Set(DEFAULT_REMASTER)
      : remasterStr === ""
        ? new Set<string>()
        : new Set(remasterStr.split(","));

  const minLevel = params.get("minlvl") ?? "";
  const maxLevel = params.get("maxlvl") ?? "";
  const sort = params.get("sort") ?? "name:asc";

  const cart = new Map<string, number>();
  const cartStr = params.get("cart");
  if (cartStr) {
    for (const entry of cartStr.split(",")) {
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
  }

  return { search, types, rarities, remaster, minLevel, maxLevel, sort, cart };
}

/** Subscribe to hash changes. */
function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashSnapshot(): string {
  return window.location.hash;
}

/**
 * Hook that syncs app state to/from the URL hash.
 * Returns current state and an update function.
 */
export function useUrlState(): [
  UrlState,
  (partial: Partial<UrlState>) => void,
] {
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot);
  const state = deserialize(hash);

  // Track whether we're currently pushing a hash change to avoid re-reading
  const isPushing = useRef(false);

  // Update URL hash when state changes
  const update = useCallback((partial: Partial<UrlState>) => {
    const current = deserialize(window.location.hash);
    const next = { ...current, ...partial };
    const newHash = serialize(next);

    if (
      newHash !== window.location.hash &&
      !(newHash === "" && !window.location.hash)
    ) {
      isPushing.current = true;
      // Use replaceState to avoid polluting browser history on every keystroke
      window.history.replaceState(
        null,
        "",
        newHash || window.location.pathname,
      );
      // Manually dispatch hashchange so useSyncExternalStore picks it up
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      isPushing.current = false;
    }
  }, []);

  return [state, update];
}

// Re-export for testing
export { deserialize as _deserialize, serialize as _serialize };
