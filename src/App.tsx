import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { Cart } from "./components/Cart";
import { ItemTable, type FilterState } from "./components/ItemTable";
import { VersionTag } from "./components/VersionTag";
import { useCart, type CartEntry } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";
import {
  cartEntriesToSavedData,
  savedListToCartEntries,
  shareDataToSavedData,
  useSavedLists,
  type SavedList,
} from "./hooks/useSavedLists";
import { useUrlState } from "./hooks/useUrlState";
import { parseCsvItems } from "./lib/csv";
import { parseBudget } from "./lib/price";
import { parseHashParams, parseShareParams, type ShareParams } from "./lib/url";
import type { Item } from "./types";

/**
 * Parse shared-link params from the initial URL hash.
 * Returns list ID and/or cart items, then strips those params from the hash.
 */
function consumeSharedHash(): ShareParams | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = parseHashParams(hash);

  const listId = params.get("lid") ?? "";
  const itemsStr = params.get("items") ?? params.get("cart") ?? "";

  // Nothing share-related in the hash
  if (!listId && !itemsStr) return null;

  const shared = parseShareParams(params);

  // Strip share-related params from the hash, keep filter/search params
  params.delete("lid");
  params.delete("items");
  params.delete("cart");
  params.delete("name");
  params.delete("char");
  params.delete("custom");
  params.delete("notes");

  // Rebuild hash with remaining params
  const remaining = params.toString();
  const newHash = remaining ? `#${remaining}` : "";
  window.history.replaceState(
    null,
    "",
    newHash || window.location.pathname + window.location.search,
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));

  return shared;
}

function App() {
  const { items, loading } = useItems();
  const [urlState, setUrlState] = useUrlState();

  // Capture shared cart from URL before any renders clear it
  const sharedCart = useRef(consumeSharedHash());

  const {
    state: cartState,
    entries,
    totalPrice,
    addItem,
    removeItem,
    setQuantity,
    setDiscount,
    setNotes,
    updateItem,
    clearCart,
    replaceCart,
  } = useCart();

  const {
    lists,
    activeList,
    activeListId,
    activeListChanged,
    saveActiveList,
    renameActiveList,
    switchToList,
    createList,
    deleteList,
  } = useSavedLists();

  // Once items are loaded, hydrate the cart (one-time).
  // Priority: shared URL > saved active list
  const cartHydrated = useRef(false);
  useEffect(() => {
    if (loading || cartHydrated.current) return;
    cartHydrated.current = true;

    const shared = sharedCart.current;
    if (shared) {
      sharedCart.current = null;

      // If the share link includes a list ID we already have, just open it
      if (shared.listId) {
        const existing = lists.find((l) => l.id === shared.listId);
        if (existing) {
          switchToList(existing.id);
          const built = savedListToCartEntries(existing, items);
          if (built) replaceCart(built);
          return;
        }
      }

      // Otherwise import the shared items into a new list
      if (shared.cart.size > 0) {
        const name = shared.charName || "Shared List";
        createList(name);
        const savedData = shareDataToSavedData(
          shared.cart,
          shared.discounts,
          shared.customItems,
          shared.notes,
        );
        // Build a temporary SavedList to reuse the standard conversion
        const tempList: SavedList = {
          id: "",
          name,
          ...savedData,
          savedAt: new Date().toISOString(),
        };
        const built = savedListToCartEntries(tempList, items);
        if (built) {
          replaceCart(built);
          saveActiveList(savedData);
        }
      }
      return;
    }

    // Otherwise load from the active saved list
    if (activeList) {
      const built = savedListToCartEntries(activeList, items);
      if (built) replaceCart(built);
    }
  }, [
    loading,
    items,
    replaceCart,
    activeList,
    createList,
    saveActiveList,
    lists,
    switchToList,
  ]);

  // When the user switches to a different saved list, load its items
  useEffect(() => {
    if (!cartHydrated.current || !activeListChanged || !activeList) return;
    const built = savedListToCartEntries(activeList, items);
    if (built) {
      replaceCart(built);
    } else {
      clearCart();
    }
  }, [activeListChanged, activeList, items, replaceCart, clearCart]);

  // Auto-save cart changes to the active saved list
  const prevCartRef = useRef(cartState);
  useEffect(() => {
    if (!cartHydrated.current) return;
    if (cartState === prevCartRef.current) return;
    prevCartRef.current = cartState;

    saveActiveList(cartEntriesToSavedData(cartState.entries));
  }, [cartState, saveActiveList]);

  // Derive filter state from URL state
  const [sortField, sortDirStr] = urlState.sort.split(":") as [
    FilterState["sortField"],
    FilterState["sortDir"],
  ];

  const filters: FilterState = {
    search: urlState.search,
    typeFilter: urlState.types,
    rarityFilter: urlState.rarities,
    remasterFilter: urlState.remaster,
    traitFilter: urlState.traits,
    minLevel: urlState.minLevel,
    maxLevel: urlState.maxLevel,
    sortField: sortField ?? "",
    sortDir: sortDirStr ?? "asc",
  };

  const handleFiltersChange = useCallback(
    (partial: Partial<FilterState>) => {
      const update: Parameters<typeof setUrlState>[0] = {};
      if ("search" in partial) {
        update.search = partial.search;
        // Clear column ordering when the search query changes
        update.sort = ":asc";
      }
      if ("typeFilter" in partial) update.types = partial.typeFilter;
      if ("rarityFilter" in partial) update.rarities = partial.rarityFilter;
      if ("remasterFilter" in partial) update.remaster = partial.remasterFilter;
      if ("traitFilter" in partial) update.traits = partial.traitFilter;
      if ("minLevel" in partial) update.minLevel = partial.minLevel;
      if ("maxLevel" in partial) update.maxLevel = partial.maxLevel;
      if ("sortField" in partial || "sortDir" in partial) {
        const sf = partial.sortField ?? filters.sortField;
        const sd = partial.sortDir ?? filters.sortDir;
        update.sort = `${sf}:${sd}`;
      }
      setUrlState(update);
    },
    [setUrlState, filters.sortField, filters.sortDir],
  );

  const handleLoadList = useCallback(
    (list: SavedList) => {
      switchToList(list.id);
    },
    [switchToList],
  );

  const handleNewList = useCallback(
    (name: string, copyItems?: boolean) => {
      createList(name);
      if (copyItems) {
        // Persist the current cart items into the newly created list
        saveActiveList(cartEntriesToSavedData(cartState.entries));
      }
    },
    [createList, cartState, saveActiveList],
  );

  const handleImportCsv = useCallback(
    (csv: string, commit: boolean): number => {
      const parsed = parseCsvItems(csv);
      if (parsed.length === 0) return 0;

      // Match CSV names to items (case-insensitive)
      const itemsByName = new Map(
        items.map((it) => [it.name.toLowerCase(), it]),
      );
      let customCounter = 0;
      const newEntries = new Map<string, CartEntry>();
      for (const {
        name,
        quantity,
        discount,
        isCustom,
        price,
        notes,
      } of parsed) {
        let item: Item | undefined;
        if (isCustom) {
          const parsedPrice = price ? parseBudget(price) : null;
          item = {
            id: `custom-csv-${++customCounter}-${Date.now()}`,
            name,
            type: "equipment",
            level: 0,
            price: parsedPrice ?? {},
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
        } else {
          item = itemsByName.get(name.toLowerCase());
        }
        if (item) {
          const existing = newEntries.get(item.id);
          newEntries.set(item.id, {
            item: item as CartEntry["item"],
            quantity: (existing?.quantity ?? 0) + quantity,
            ...(discount ? { discount } : {}),
            ...(notes ? { notes } : {}),
          });
        }
      }
      if (newEntries.size === 0) return 0;

      if (commit) {
        replaceCart(newEntries);
      }
      return newEntries.size;
    },
    [items, replaceCart],
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading item data...</p>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>
          Pathshopper{" "}
          {__PR_NUMBER__ ? (
            <a
              href={`https://github.com/evrys/pathshopper2e/pull/${__PR_NUMBER__}`}
              className={styles.badge}
              target="_blank"
              rel="noopener noreferrer"
            >
              dev preview
            </a>
          ) : (
            <span className={styles.badge}>beta</span>
          )}
        </h1>
        <p className={styles.subtitle}>
          Plan a shopping list for your PF2e character
        </p>
      </header>

      <div className={styles.body}>
        <main>
          <ItemTable
            items={items}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onAddItem={addItem}
          />
        </main>
        <aside className={styles.sidebar}>
          <Cart
            entries={entries}
            totalPrice={totalPrice}
            allItems={items}
            listName={activeList?.name ?? "My shopping list"}
            lists={lists}
            activeListId={activeListId}
            onListNameChange={renameActiveList}
            onSetQuantity={setQuantity}
            onRemoveItem={removeItem}
            onSetDiscount={setDiscount}
            onSetNotes={setNotes}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onLoadList={handleLoadList}
            onNewList={handleNewList}
            onDeleteList={deleteList}
            onImportCsv={handleImportCsv}
          />
        </aside>
      </div>
      <VersionTag />
    </div>
  );
}

export default App;
