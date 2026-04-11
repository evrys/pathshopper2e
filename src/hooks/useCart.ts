import { useCallback, useReducer } from "react";
import { resolvePriceModifier, sumPrices, toCopper } from "../lib/price";
import type { Item, Price, PriceModifier } from "../types";

export type CartSortOrder =
  | "manual"
  | "level-asc"
  | "level-desc"
  | "price-asc"
  | "price-desc";

export interface CartEntry {
  item: Item;
  quantity: number;
  /** Price modifier applied to each unit's price. */
  priceModifier?: PriceModifier;
  /** Free-form notes about this item (e.g. where to buy, why you need it). */
  notes?: string;
}

export interface CartState {
  entries: Map<string, CartEntry>;
}

export type CartAction =
  | { type: "add"; item: Item }
  | { type: "remove"; itemId: string }
  | { type: "set-quantity"; itemId: string; quantity: number }
  | {
      type: "set-price-modifier";
      itemId: string;
      priceModifier: PriceModifier | undefined;
    }
  | { type: "set-notes"; itemId: string; notes: string }
  | {
      type: "update-item";
      itemId: string;
      update: { name?: string; price?: Price };
    }
  | { type: "clear" }
  | { type: "replace"; entries: Map<string, CartEntry> }
  | { type: "reorder"; orderedIds: string[] };

export function cartReducer(state: CartState, action: CartAction): CartState {
  const next = new Map(state.entries);

  switch (action.type) {
    case "add": {
      const existing = next.get(action.item.id);
      if (existing) {
        next.set(action.item.id, {
          ...existing,
          quantity: existing.quantity + 1,
        });
      } else {
        next.set(action.item.id, { item: action.item, quantity: 1 });
      }
      break;
    }
    case "remove":
      next.delete(action.itemId);
      break;
    case "set-quantity":
      if (action.quantity <= 0) {
        next.delete(action.itemId);
      } else {
        const entry = next.get(action.itemId);
        if (entry) {
          next.set(action.itemId, { ...entry, quantity: action.quantity });
        }
      }
      break;
    case "set-price-modifier": {
      const entry = next.get(action.itemId);
      if (entry) {
        next.set(action.itemId, {
          ...entry,
          priceModifier: action.priceModifier,
        });
      }
      break;
    }
    case "set-notes": {
      const entry = next.get(action.itemId);
      if (entry) {
        const notes = action.notes || undefined; // clear empty strings
        next.set(action.itemId, { ...entry, notes });
      }
      break;
    }
    case "update-item": {
      const entry = next.get(action.itemId);
      if (entry) {
        const item = { ...entry.item };
        if (action.update.name !== undefined) item.name = action.update.name;
        if (action.update.price !== undefined) item.price = action.update.price;
        next.set(action.itemId, { ...entry, item });
      }
      break;
    }
    case "clear":
      return { entries: new Map() };
    case "replace":
      return { entries: action.entries };
    case "reorder": {
      const reordered = new Map<string, CartEntry>();
      for (const id of action.orderedIds) {
        const entry = next.get(id);
        if (entry) reordered.set(id, entry);
      }
      return { entries: reordered };
    }
  }

  return { entries: next };
}

/** Sort cart entries by the given order. Returns a new array. */
export function sortEntries(
  entries: CartEntry[],
  order: CartSortOrder,
): CartEntry[] {
  if (order === "manual") return [...entries];

  const desc = order.endsWith("-desc") ? -1 : 1;
  const field = order.startsWith("level") ? "level" : "price";

  return [...entries].sort((a, b) => {
    const diff =
      field === "level"
        ? a.item.level - b.item.level
        : toCopper(a.item.price) - toCopper(b.item.price);
    if (diff !== 0) return diff * desc;
    return a.item.name.localeCompare(b.item.name);
  });
}

export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, {
    entries: new Map(),
  });

  const addItem = useCallback(
    (item: Item) => dispatch({ type: "add", item }),
    [],
  );
  const removeItem = useCallback(
    (itemId: string) => dispatch({ type: "remove", itemId }),
    [],
  );
  const setQuantity = useCallback(
    (itemId: string, quantity: number) =>
      dispatch({ type: "set-quantity", itemId, quantity }),
    [],
  );
  const setDiscount = useCallback(
    (itemId: string, priceModifier: PriceModifier | undefined) =>
      dispatch({ type: "set-price-modifier", itemId, priceModifier }),
    [],
  );
  const setNotes = useCallback(
    (itemId: string, notes: string) =>
      dispatch({ type: "set-notes", itemId, notes }),
    [],
  );
  const updateItem = useCallback(
    (itemId: string, update: { name?: string; price?: Price }) =>
      dispatch({ type: "update-item", itemId, update }),
    [],
  );
  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);
  const replaceCart = useCallback(
    (entries: Map<string, CartEntry>) => dispatch({ type: "replace", entries }),
    [],
  );
  const reorderItems = useCallback(
    (orderedIds: string[]) => dispatch({ type: "reorder", orderedIds }),
    [],
  );

  const entries = [...state.entries.values()];

  const totalPrice = sumPrices(
    entries.map((e) => ({
      price: e.item.price,
      quantity: e.quantity,
      priceModifier: e.priceModifier,
    })),
  );
  const totalCopper = entries.reduce((sum, e) => {
    const adjustCp = e.priceModifier
      ? resolvePriceModifier(e.priceModifier, e.item.price)
      : 0;
    return sum + (toCopper(e.item.price) + adjustCp) * e.quantity;
  }, 0);
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);

  return {
    state,
    entries,
    totalPrice,
    totalCopper,
    totalItems,
    addItem,
    removeItem,
    setQuantity,
    setDiscount,
    setNotes,
    updateItem,
    clearCart,
    replaceCart,
    reorderItems,
  };
}
