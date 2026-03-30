import { useCallback, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { Cart } from "./components/Cart";
import { ItemTable, type FilterState } from "./components/ItemTable";
import { useCart, type CartEntry } from "./hooks/useCart";
import { useItems } from "./hooks/useItems";
import { useUrlState } from "./hooks/useUrlState";

/** Build cart entries from URL cart state + loaded items (one-time init). */
function buildInitialCart(
  items: { id: string }[],
  urlCart: Map<string, number>,
): Map<string, CartEntry> | undefined {
  if (urlCart.size === 0) return undefined;
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const map = new Map<string, CartEntry>();
  for (const [id, qty] of urlCart) {
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
    replaceCart,
  } = useCart();

  // Once items are loaded, hydrate the cart from the URL (one-time)
  const cartHydrated = useRef(false);
  useEffect(() => {
    if (loading || cartHydrated.current) return;
    cartHydrated.current = true;
    const urlCart = initialUrlCart.current;
    if (urlCart.size === 0) return;
    const built = buildInitialCart(items, urlCart);
    if (built) {
      replaceCart(built);
    }
  }, [loading, items, replaceCart]);

  // Sync cart state → URL whenever cart changes
  const prevCartRef = useRef(cartState);
  useEffect(() => {
    if (cartState === prevCartRef.current) return;
    prevCartRef.current = cartState;
    const cart = new Map<string, number>();
    for (const [id, entry] of cartState.entries) {
      cart.set(id, entry.quantity);
    }
    setUrlState({ cart });
  }, [cartState, setUrlState]);

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
    minLevel: urlState.minLevel,
    maxLevel: urlState.maxLevel,
    sortField: sortField ?? "",
    sortDir: sortDirStr ?? "asc",
  };

  const handleFiltersChange = useCallback(
    (partial: Partial<FilterState>) => {
      const update: Parameters<typeof setUrlState>[0] = {};
      if ("search" in partial) update.search = partial.search;
      if ("typeFilter" in partial) update.types = partial.typeFilter;
      if ("rarityFilter" in partial) update.rarities = partial.rarityFilter;
      if ("remasterFilter" in partial) update.remaster = partial.remasterFilter;
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

  const handleCharNameChange = useCallback(
    (name: string) => setUrlState({ charName: name }),
    [setUrlState],
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
          Pathshopper <span className={styles.beta}>beta</span>
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
            charName={urlState.charName}
            onCharNameChange={handleCharNameChange}
            onSetQuantity={setQuantity}
            onRemoveItem={removeItem}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
