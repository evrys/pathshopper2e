import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { Cart } from "./components/Cart";
import { ItemTable, type FilterState } from "./components/ItemTable";
import { VersionTag } from "./components/VersionTag";
import { useCart, type CartEntry } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";
import { useSavedLists, type SavedList } from "./hooks/useSavedLists";
import { useUrlState } from "./hooks/useUrlState";

/** Build cart entries from a plain id→quantity map + loaded items. */
function buildCartEntries(
  items: { id: string }[],
  itemQuantities: Map<string, number>,
): Map<string, CartEntry> | undefined {
  if (itemQuantities.size === 0) return undefined;
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const map = new Map<string, CartEntry>();
  for (const [id, qty] of itemQuantities) {
    const item = itemMap.get(id);
    if (item) {
      map.set(id, { item: item as CartEntry["item"], quantity: qty });
    }
  }
  return map.size > 0 ? map : undefined;
}

function App() {
  const { items, loading } = useItems();
  const [urlState, setUrlState] = useUrlState();

  // Capture the initial URL cart before any state changes
  const initialUrlCart = useRef(urlState.cart);

  const {
    state: cartState,
    entries,
    totalPrice,
    totalItems,
    addItem,
    removeItem,
    setQuantity,
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
  // Priority: URL cart > saved active list
  const cartHydrated = useRef(false);
  useEffect(() => {
    if (loading || cartHydrated.current) return;
    cartHydrated.current = true;

    const urlCart = initialUrlCart.current;
    if (urlCart.size > 0) {
      // URL takes priority (e.g. shared link)
      const built = buildCartEntries(items, urlCart);
      if (built) replaceCart(built);
      return;
    }

    // Otherwise load from the active saved list
    if (activeList && Object.keys(activeList.items).length > 0) {
      const built = buildCartEntries(
        items,
        new Map(Object.entries(activeList.items)),
      );
      if (built) replaceCart(built);
    }
  }, [loading, items, replaceCart, activeList]);

  // When the user switches to a different saved list, load its items
  useEffect(() => {
    if (!cartHydrated.current || !activeListChanged || !activeList) return;
    const savedItems = new Map(Object.entries(activeList.items));
    if (savedItems.size === 0) {
      clearCart();
      return;
    }
    const built = buildCartEntries(items, savedItems);
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

    // Sync to URL
    const cart = new Map<string, number>();
    for (const [id, entry] of cartState.entries) {
      cart.set(id, entry.quantity);
    }
    setUrlState({ cart });

    // Auto-save to active list
    saveActiveList(cart);
  }, [cartState, setUrlState, saveActiveList]);

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
    (name: string) => {
      createList(name);
    },
    [createList],
  );

  const handleListNameChange = useCallback(
    (name: string) => {
      renameActiveList(name);
      setUrlState({ charName: name });
    },
    [renameActiveList, setUrlState],
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
            totalItems={totalItems}
            listName={activeList?.name ?? "Shopping List"}
            lists={lists}
            activeListId={activeListId}
            onListNameChange={handleListNameChange}
            onSetQuantity={setQuantity}
            onRemoveItem={removeItem}
            onLoadList={handleLoadList}
            onNewList={handleNewList}
            onDeleteList={deleteList}
          />
        </aside>
      </div>
      <VersionTag />
    </div>
  );
}

export default App;
