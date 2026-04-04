import { useCallback, useReducer } from "react";
import { resolveDiscount, sumPrices, toCopper } from "../lib/price";
import type { Discount, Item } from "../types";

export interface CartEntry {
  item: Item;
  quantity: number;
  /** Discount applied to each unit's price. */
  discount?: Discount;
}

export interface CartState {
  entries: Map<string, CartEntry>;
}

export type CartAction =
  | { type: "add"; item: Item }
  | { type: "remove"; itemId: string }
  | { type: "set-quantity"; itemId: string; quantity: number }
  | { type: "set-discount"; itemId: string; discount: Discount | undefined }
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
    case "set-discount": {
      const entry = next.get(action.itemId);
      if (entry) {
        next.set(action.itemId, { ...entry, discount: action.discount });
      }
      break;
    }
    case "clear":
      return { entries: new Map() };
    case "replace":
      return { entries: action.entries };
  }

  return { entries: next };
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
    (itemId: string, discount: Discount | undefined) =>
      dispatch({ type: "set-discount", itemId, discount }),
    [],
  );
  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);
  const replaceCart = useCallback(
    (entries: Map<string, CartEntry>) => dispatch({ type: "replace", entries }),
    [],
  );

  const entries = [...state.entries.values()];

  const totalPrice = sumPrices(
    entries.map((e) => ({
      price: e.item.price,
      quantity: e.quantity,
      discount: e.discount,
    })),
  );
  const totalCopper = entries.reduce((sum, e) => {
    const discountCp = e.discount
      ? resolveDiscount(e.discount, e.item.price)
      : 0;
    return sum + Math.max(0, toCopper(e.item.price) - discountCp) * e.quantity;
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
    clearCart,
    replaceCart,
  };
}
