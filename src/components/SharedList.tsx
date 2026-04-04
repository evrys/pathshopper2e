import { useCallback, useMemo } from "react";
import { useItems } from "../hooks/useItems";
import {
  generateListId,
  saveListToStorage,
  type SavedList,
} from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { formatPrice, sumPrices } from "../lib/price";
import { parseHashParams, parseShareParams } from "../lib/url";
import type { Discount, Item } from "../types";
import { ItemTooltipWrapper } from "./ItemTooltip";
import styles from "./SharedList.module.css";
import { VersionTag } from "./VersionTag";

interface ListEntry {
  item: Item;
  quantity: number;
  discount?: Discount;
}

export function SharedList() {
  const { items, loading } = useItems();
  const { cart, charName, listId, customItems, discounts } = useMemo(
    () => parseShareParams(parseHashParams(window.location.hash)),
    [],
  );

  const entries = useMemo(() => {
    if (loading || cart.size === 0) return [];
    const itemMap = new Map(items.map((it) => [it.id, it]));
    for (const ci of customItems) {
      itemMap.set(ci.id, ci);
    }
    const result: ListEntry[] = [];
    for (const [id, qty] of cart) {
      const item = itemMap.get(id);
      if (item) {
        const discount = discounts.get(id);
        result.push({ item, quantity: qty, discount });
      }
    }
    return result;
  }, [items, loading, cart, customItems, discounts]);

  const totalPrice = useMemo(
    () =>
      sumPrices(
        entries.map((e) => ({
          price: e.item.price,
          quantity: e.quantity,
          discount: e.discount,
        })),
      ),
    [entries],
  );
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);

  const title = charName ? charName : "My shopping list";

  /** Save the shared list to localStorage and navigate to the editor. */
  const handleEdit = useCallback(() => {
    const id = listId || generateListId();
    const list: SavedList = {
      id,
      name: charName || "Shared List",
      items: Object.fromEntries(cart),
      savedAt: new Date().toISOString(),
    };
    saveListToStorage(list);

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${window.location.origin}${base}/#lid=${encodeURIComponent(id)}`;
  }, [cart, charName, listId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <p className={styles.subtitle}>
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className={styles.empty}>This shopping list is empty.</p>
      ) : (
        <>
          <ul className={styles.items}>
            {entries.map(({ item, quantity, discount }) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemInfo}>
                  {item.id.startsWith("custom-") ? (
                    <span className={styles.itemName}>{item.name}</span>
                  ) : (
                    <ItemTooltipWrapper item={item}>
                      <a
                        className={styles.itemName}
                        href={aonUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.name}
                      </a>
                    </ItemTooltipWrapper>
                  )}
                  <span className={styles.itemMeta}>
                    {!item.id.startsWith("custom-") && `Level ${item.level} · `}
                    {discount ? (
                      <>
                        <span className={styles.originalPrice}>
                          {formatPrice(item.price)}
                        </span>{" "}
                        {formatPrice(item.price, discount)}
                      </>
                    ) : (
                      formatPrice(item.price)
                    )}
                    {quantity > 1 && " each"}
                  </span>
                </div>
                {quantity > 1 && (
                  <span className={styles.qty}>&times;{quantity}</span>
                )}
              </li>
            ))}
          </ul>

          <div className={styles.total}>
            <span>Total</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
        </>
      )}

      <footer className={styles.footer}>
        <button type="button" className={styles.editLink} onClick={handleEdit}>
          Edit this list
        </button>
        {" · "}
        <a href={`${import.meta.env.BASE_URL}`}>
          Create a new list on Pathshopper
        </a>
      </footer>
      <VersionTag />
    </div>
  );
}
