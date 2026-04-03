import { useMemo } from "react";
import { useItems } from "../hooks/useItems";
import { aonUrl } from "../lib/aon";
import { formatPrice, sumPrices } from "../lib/price";
import { parseCartString } from "../lib/url";
import type { Item } from "../types";
import { ItemTooltipWrapper } from "./ItemTooltip";
import styles from "./SharedList.module.css";
import { VersionTag } from "./VersionTag";

interface ListEntry {
  item: Item;
  quantity: number;
}

/** Parse the URL hash into a cart map and list name. */
function parseShareHash(hash: string): {
  cart: Map<string, number>;
  charName: string;
} {
  const str = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(str.replace(/\+/g, "%2B"));

  const charName = params.get("name") ?? params.get("char") ?? "";
  const cart = parseCartString(params.get("cart") ?? "");

  return { cart, charName };
}

/** Build a URL to the editor with the current cart + list name pre-filled. */
function buildEditUrl(cart: Map<string, number>, charName: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const params = new URLSearchParams();

  if (charName) params.set("name", charName);

  if (cart.size > 0) {
    const cartStr = [...cart]
      .map(([id, qty]) => (qty === 1 ? id : `${id}*${qty}`))
      .join("+");
    params.set("cart", cartStr);
  }

  const parts: string[] = [];
  for (const [key, value] of params) {
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%2B/gi, "+")}`,
    );
  }
  const hash = parts.length > 0 ? `#${parts.join("&")}` : "";
  return `${window.location.origin}${base}/${hash}`;
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

  const totalPrice = useMemo(
    () =>
      sumPrices(
        entries.map((e) => ({ price: e.item.price, quantity: e.quantity })),
      ),
    [entries],
  );
  const totalItems = entries.reduce((sum, e) => sum + e.quantity, 0);

  const title = charName ? charName : "Shopping List";

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
        <a href={buildEditUrl(cart, charName)}>Edit this list</a>
        {" · "}
        <a href={`${import.meta.env.BASE_URL}`}>
          Create a new list on Pathshopper
        </a>
      </footer>
      <VersionTag />
    </div>
  );
}
