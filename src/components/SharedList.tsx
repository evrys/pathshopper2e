import { useMemo } from "react";
import { useItems } from "../hooks/useItems";
import { aonUrl } from "../lib/aon";
import { formatPrice, fromCopper, toCopper } from "../lib/price";
import type { Item, Price } from "../types";
import { ItemTooltipWrapper } from "./ItemTooltip";
import styles from "./SharedList.module.css";

interface ListEntry {
  item: Item;
  quantity: number;
}

/** Parse the URL hash into a cart map and character name. */
function parseShareHash(hash: string): {
  cart: Map<string, number>;
  charName: string;
} {
  const str = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(str.replace(/\+/g, "%2B"));

  const charName = params.get("char") ?? "";
  const cart = new Map<string, number>();
  const cartStr = params.get("cart");
  if (cartStr) {
    for (const entry of cartStr.split("+")) {
      const colonIdx = entry.lastIndexOf(":");
      if (colonIdx === -1) {
        cart.set(entry, 1);
      } else {
        const id = entry.slice(0, colonIdx);
        const qty = Number.parseInt(entry.slice(colonIdx + 1), 10);
        if (id && Number.isFinite(qty) && qty > 0) {
          cart.set(id, qty);
        } else if (id && Number.isNaN(qty)) {
          cart.set(entry, 1);
        }
      }
    }
  }

  return { cart, charName };
}

function computeTotal(entries: ListEntry[]): Price {
  let totalCp = 0;
  for (const { item, quantity } of entries) {
    totalCp += toCopper(item.price) * quantity;
  }
  return fromCopper(totalCp);
}

export function SharedList() {
  const { items, loading } = useItems();
  const { cart, charName } = useMemo(
    () => parseShareHash(window.location.hash),
    [],
  );

  const entries = useMemo(() => {
    if (loading || cart.size === 0) return [];
    const itemMap = new Map(items.map((it) => [it.id, it]));
    const result: ListEntry[] = [];
    for (const [id, qty] of cart) {
      const item = itemMap.get(id);
      if (item) result.push({ item, quantity: qty });
    }
    return result;
  }, [items, loading, cart]);

  const totalPrice = useMemo(() => computeTotal(entries), [entries]);
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);

  const title = charName ? `${charName}\u2019s Shopping List` : "Shopping List";

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
            {entries.map(({ item, quantity }) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemInfo}>
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
                  <span className={styles.itemMeta}>
                    Level {item.level} &middot; {formatPrice(item.price)}
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
        <a href={`${import.meta.env.BASE_URL}`}>
          Create your own list on Pathshopper
        </a>
      </footer>
    </div>
  );
}
