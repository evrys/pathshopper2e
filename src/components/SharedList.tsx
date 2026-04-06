import { useCallback, useMemo } from "react";
import { useItems } from "../hooks/useItems";
import { useIsMobile } from "../hooks/useMediaQuery";
import {
  generateListId,
  saveListToStorage,
  shareDataToSavedData,
  type SavedList,
} from "../hooks/useSavedLists";
import { aonUrl } from "../lib/aon";
import { formatPrice, modifierLabel, sumPrices } from "../lib/price";
import { parseHashParams, parseShareParams } from "../lib/url";
import type { Item, PriceModifier } from "../types";
import { ItemTooltipWrapper, useMobileTooltip } from "./ItemTooltip";
import styles from "./SharedList.module.css";
import { VersionTag } from "./VersionTag";

interface ListEntry {
  item: Item;
  quantity: number;
  priceModifier?: PriceModifier;
  notes?: string;
}

/** Shared list item that opens the tooltip on any tap (mobile). */
function MobileSharedListItem({ entry }: { entry: ListEntry }) {
  const { item, quantity, priceModifier, notes: itemNotes } = entry;
  const isCustom = item.id.startsWith("custom-");
  const { rowProps, portal } = useMobileTooltip(item);

  return (
    <li className={styles.item} {...(isCustom ? {} : rowProps)}>
      <div className={styles.itemInfo}>
        <span className={styles.itemName}>{item.name}</span>
        <span className={styles.itemMeta}>
          {!isCustom && `Level ${item.level} · `}
          {priceModifier ? (
            <>
              <span className={styles.originalPrice}>
                {formatPrice(item.price)}
              </span>{" "}
              {formatPrice(item.price, priceModifier)}
              {modifierLabel(priceModifier) &&
                ` ${modifierLabel(priceModifier)}`}
            </>
          ) : (
            formatPrice(item.price)
          )}
          {quantity > 1 && " each"}
        </span>
        {itemNotes && <span className={styles.itemNotes}>{itemNotes}</span>}
      </div>
      {quantity > 1 && <span className={styles.qty}>&times;{quantity}</span>}
      {portal}
    </li>
  );
}

export function SharedList() {
  const { items, loading } = useItems();
  const { cart, charName, listId, customItems, priceModifiers, notes } =
    useMemo(() => parseShareParams(parseHashParams(window.location.hash)), []);

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
        const priceModifier = priceModifiers.get(id);
        const note = notes.get(id);
        result.push({ item, quantity: qty, priceModifier, notes: note });
      }
    }
    return result;
  }, [items, loading, cart, customItems, priceModifiers, notes]);

  const totalPrice = useMemo(
    () =>
      sumPrices(
        entries.map((e) => ({
          price: e.item.price,
          quantity: e.quantity,
          priceModifier: e.priceModifier,
        })),
      ),
    [entries],
  );
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);

  const title = charName ? charName : "Shopping list";

  const isMobile = useIsMobile();

  /** Save the shared list to localStorage and navigate to the editor. */
  const handleEdit = useCallback(() => {
    const id = listId || generateListId();
    const savedData = shareDataToSavedData(
      cart,
      priceModifiers,
      customItems,
      notes,
    );
    const list: SavedList = {
      id,
      name: charName || "Shared List",
      ...savedData,
      savedAt: new Date().toISOString(),
    };
    saveListToStorage(list);

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${window.location.origin}${base}/#lid=${encodeURIComponent(id)}`;
  }, [cart, charName, listId, priceModifiers, customItems, notes]);

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
            {entries.map((entry) =>
              isMobile ? (
                <MobileSharedListItem key={entry.item.id} entry={entry} />
              ) : (
                <li key={entry.item.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    {entry.item.id.startsWith("custom-") ? (
                      <span className={styles.itemName}>{entry.item.name}</span>
                    ) : (
                      <ItemTooltipWrapper item={entry.item}>
                        <a
                          className={styles.itemName}
                          href={aonUrl(entry.item)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {entry.item.name}
                        </a>
                      </ItemTooltipWrapper>
                    )}
                    <span className={styles.itemMeta}>
                      {!entry.item.id.startsWith("custom-") &&
                        `Level ${entry.item.level} · `}
                      {entry.priceModifier ? (
                        <>
                          <span className={styles.originalPrice}>
                            {formatPrice(entry.item.price)}
                          </span>{" "}
                          {formatPrice(entry.item.price, entry.priceModifier)}
                          {modifierLabel(entry.priceModifier) &&
                            ` ${modifierLabel(entry.priceModifier)}`}
                        </>
                      ) : (
                        formatPrice(entry.item.price)
                      )}
                      {entry.quantity > 1 && " each"}
                    </span>
                    {entry.notes && (
                      <span className={styles.itemNotes}>{entry.notes}</span>
                    )}
                  </div>
                  {entry.quantity > 1 && (
                    <span className={styles.qty}>&times;{entry.quantity}</span>
                  )}
                </li>
              ),
            )}
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
