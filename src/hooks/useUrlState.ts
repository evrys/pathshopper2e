import { useCallback, useRef, useSyncExternalStore } from "react";
import { DEFAULT_RARITIES, DEFAULT_REMASTER } from "../lib/constants";
import { parseCartString } from "../lib/url";

/**
 * App state that gets persisted in the URL hash.
 * Only non-default values are serialized to keep URLs short.
 */
export interface UrlState {
  search: string;
  types: Set<string>;
  rarities: Set<string>;
  remaster: Set<string>;
  traits: Set<string>;
  minLevel: string;
  maxLevel: string;
  sort: string; // "field:dir", e.g. "name:asc"
  charName: string;
  /** Cart as Map of item id → quantity */
  cart: Map<string, number>;
}

const DEFAULTS: UrlState = {
  search: "",
  types: new Set(),
  rarities: DEFAULT_RARITIES,
  remaster: DEFAULT_REMASTER,
  traits: new Set(),
  minLevel: "",
  maxLevel: "",
  sort: ":asc",
  charName: "",
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
    params.set("type", [...state.types].sort().join("+"));
  if (!setsEqual(state.rarities, DEFAULT_RARITIES))
    params.set("rarity", [...state.rarities].sort().join("+"));
  if (!setsEqual(state.remaster, DEFAULT_REMASTER))
    params.set("remaster", [...state.remaster].sort().join("+"));
  if (state.traits.size > 0)
    params.set("traits", [...state.traits].sort().join("+"));
  if (state.minLevel) params.set("minlvl", state.minLevel);
  if (state.maxLevel) params.set("maxlvl", state.maxLevel);
  if (state.sort !== DEFAULTS.sort) params.set("sort", state.sort);
  if (state.charName) params.set("char", state.charName);

  if (state.cart.size > 0) {
    const cartStr = [...state.cart]
      .map(([id, qty]) => (qty === 1 ? id : `${id}*${qty}`))
      .join("+");
    params.set("cart", cartStr);
  }

  // Build the hash ourselves to avoid URLSearchParams encoding `+` as `%2B`
  const parts: string[] = [];
  for (const [key, value] of params) {
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%2B/gi, "+")}`,
    );
  }
  const str = parts.join("&");
  return str ? `#${str}` : "";
}

/** Parse URL hash string back into state. */
function deserialize(hash: string): UrlState {
  const str = hash.startsWith("#") ? hash.slice(1) : hash;
  // Replace unencoded `+` with `%2B` before URLSearchParams parses them as spaces
  const params = new URLSearchParams(str.replace(/\+/g, "%2B"));

  const search = params.get("q") ?? "";

  const typeStr = params.get("type");
  const types = typeStr ? new Set(typeStr.split("+")) : new Set<string>();

  const rarityStr = params.get("rarity");
  // If rarity param is absent, use defaults. If present but empty, means "all rarities" (empty set).
  const rarities =
    rarityStr === null
      ? new Set(DEFAULT_RARITIES)
      : rarityStr === ""
        ? new Set<string>()
        : new Set(rarityStr.split("+"));

  const remasterStr = params.get("remaster");
  // If remaster param is absent, use defaults. If present but empty, means "all content" (empty set).
  const remaster =
    remasterStr === null
      ? new Set(DEFAULT_REMASTER)
      : remasterStr === ""
        ? new Set<string>()
        : new Set(remasterStr.split("+"));

  const traitsStr = params.get("traits");
  const traits = traitsStr ? new Set(traitsStr.split("+")) : new Set<string>();

  const minLevel = params.get("minlvl") ?? "";
  const maxLevel = params.get("maxlvl") ?? "";
  const sort = params.get("sort") ?? ":asc";
  const charName = params.get("char") ?? "";

  const cart = parseCartString(params.get("cart") ?? "");

  return {
    search,
    types,
    rarities,
    remaster,
    traits,
    minLevel,
    maxLevel,
    sort,
    charName,
    cart,
  };
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
