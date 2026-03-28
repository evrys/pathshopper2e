import { useCallback, useReducer } from "react";
import { fromCopper, toCopper } from "../lib/price";
import type { Item, Price } from "../types";

export interface CartEntry {
  item: Item;
  quantity: number;
}

export interface CartState {
  entries: Map<string, CartEntry>;
}

export type CartAction =
  | { type: "add"; item: Item }
  | { type: "remove"; itemId: string }
  | { type: "set-quantity"; itemId: string; quantity: number }
  | { type: "clear" }
  | { type: "replace"; entries: Map<string, CartEntry> };

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
    case "clear":
      return { entries: new Map() };
    case "replace":
      return { entries: action.entries };
  }

  return { entries: next };
}

export function useCart(initialEntries?: Map<string, CartEntry>) {
  const [state, dispatch] = useReducer(cartReducer, {
    entries: initialEntries ?? new Map(),
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
  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);
  const replaceCart = useCallback(
    (entries: Map<string, CartEntry>) => dispatch({ type: "replace", entries }),
    [],
  );

  const entries = [...state.entries.values()];

  const totalCopper = entries.reduce(
    (sum, e) => sum + toCopper(e.item.price) * e.quantity,
    0,
  );
  const totalPrice: Price = fromCopper(totalCopper);
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
    clearCart,
    replaceCart,
  };
}
